"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  type CartAdjustmentDto,
  type CartLineDto,
} from "@crochet-peakz/shared";
import { useSession } from "@/lib/auth/use-session";
import { quoteCartLines } from "@/lib/cart/api";
import {
  GUEST_CART_STORAGE_KEY,
  useGuestCartStore,
} from "@/lib/cart/guest-cart-store";
import {
  CART_FULL_TOAST,
  CART_ITEM_UNAVAILABLE_TOAST,
  CART_UPDATE_ERROR_TOAST,
} from "@/lib/cart/labels";

/** Operating mode for `CartProvider`. */
export type CartMode = "visitor" | "account";

/** Input accepted by `addItem`. */
export interface AddToCartInput {
  /** Product UUID. */
  productId: string;
  /** Variant UUID. */
  variantId: string;
  /** Product title for polite announcement fallback. */
  title: string;
  /** Optional trigger element so focus returns to it when the drawer closes. */
  triggerEl?: HTMLElement | null;
}

/** Public value provided by {@link CartProvider}. */
export interface CartContextValue {
  /** Whether the cart currently targets the browser store or the server account cart. */
  mode: CartMode;
  /** True after post mount hydration finishes (prevents SSR mismatch). */
  hydrated: boolean;
  /** Total item count displayed on the header badge. */
  itemCount: number;
  /** Live resolved cart lines ordered newest first. */
  lines: CartLineDto[];
  /** True while loading the initial cart or revalidating with no cached lines yet. */
  loading: boolean;
  /** True while a background revalidation is in flight. */
  revalidating: boolean;
  /** True when the last live check (quote or initial load) failed. */
  loadError: boolean;
  /** Whether the slide out cart drawer is open. */
  drawerOpen: boolean;
  /** Variant currently being added from a product page, or `null`. */
  addingVariantId: string | null;
  /** Variants with an active quantity or remove mutation in flight. */
  pendingVariantIds: ReadonlySet<string>;
  /** True while clearing the whole cart. */
  clearing: boolean;
  /**
   * Session memory map of variants whose quantity was lowered on a live check,
   * keyed by `variantId` -> lowered quantity. Kept visible across reads until
   * the shopper changes, removes, or clears that line (AC-7).
   */
  loweredNotices: Readonly<Record<string, number>>;
  /** Variant that hit its maximum on the last add attempt (`AT_LIMIT`, AC-6). */
  atLimitVariantId: string | null;
  /** Dismissible merge banner adjustments after sign in (AC-11). */
  mergeAdjustments: CartAdjustmentDto[];
  /** Latest polite announcement text for screen reader live regions. */
  announcement: string;
  /** Element that opened the drawer so focus returns cleanly on close. */
  drawerTriggerEl: HTMLElement | null;
  /** Opens the cart drawer and triggers a live revalidation. */
  openDrawer: (triggerEl?: HTMLElement | null) => void;
  /** Closes the cart drawer. */
  closeDrawer: () => void;
  /** Revalidates live stock and pricing against the API. */
  refreshCart: () => Promise<void>;
  /** Adds one unit of the selected variant to the cart. */
  addItem: (input: AddToCartInput) => Promise<void>;
  /** Updates the quantity of an existing cart line. */
  setItemQuantity: (variantId: string, quantity: number) => Promise<void>;
  /** Removes a line from the cart. */
  removeItem: (variantId: string) => Promise<void>;
  /** Empties all lines from the cart. */
  clearCart: () => Promise<boolean>;
  /** Dismisses the post sign in merge banner. */
  dismissMergeBanner: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const subscribeHydration = (): (() => void) => () => undefined;
const getClientHydrated = (): boolean => true;
const getServerHydrated = (): boolean => false;

/** Props for {@link CartProvider}. */
export interface CartProviderProps {
  /** Storefront subtree with cart state and drawer access. */
  children: ReactNode;
}

/**
 * Provides shopping cart state across the storefront shell.
 *
 * Milestone 1 powers the full visitor cart flow (Zustand `persist` with
 * `skipHydration: true`, live `/api/cart/quote`, cross tab `storage` sync,
 * and shared `SessionProvider` awareness). Account mode and sign in merge
 * build on this provider in Milestones 3 and 4.
 */
export function CartProvider({ children }: CartProviderProps) {
  const { user } = useSession();
  const mode: CartMode = user ? "account" : "visitor";

  const guestLines = useGuestCartStore((state) => state.lines);

  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrated,
    getServerHydrated,
  );
  const [resolvedLines, setResolvedLines] = useState<CartLineDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTriggerEl, setDrawerTriggerEl] = useState<HTMLElement | null>(
    null,
  );
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const [pendingVariantIds, setPendingVariantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [clearing, setClearing] = useState(false);
  const [loweredNotices, setLoweredNotices] = useState<Record<string, number>>(
    {},
  );
  const [atLimitVariantId, setAtLimitVariantId] = useState<string | null>(null);
  const [mergeAdjustments, setMergeAdjustments] = useState<CartAdjustmentDto[]>(
    [],
  );
  const [announcement, setAnnouncement] = useState("");

  const requestCounterRef = useRef(0);

  const announce = useCallback((message: string) => {
    // Clearing before setting ensures repeated identical announcements still
    // fire cleanly in assistive tech live regions.
    setAnnouncement("");
    queueMicrotask(() => {
      setAnnouncement(message);
    });
  }, []);

  const recordLoweredFromLines = useCallback(
    (nextLines: readonly CartLineDto[]) => {
      const newlyLowered: Record<string, number> = {};
      for (const line of nextLines) {
        if (line.status === "LOWERED") {
          newlyLowered[line.variantId] = line.quantity;
        }
      }
      if (Object.keys(newlyLowered).length > 0) {
        useGuestCartStore.getState().applyQuoteLowering(newlyLowered);
        setLoweredNotices((prev) => ({ ...prev, ...newlyLowered }));
      }
    },
    [],
  );

  const clearLineNotices = useCallback((variantId: string) => {
    setLoweredNotices((prev) => {
      if (!(variantId in prev)) {
        return prev;
      }
      return Object.fromEntries(
        Object.entries(prev).filter(([key]) => key !== variantId),
      );
    });
    setAtLimitVariantId((prev) => (prev === variantId ? null : prev));
  }, []);

  const quoteCurrentGuestCart = useCallback(async (): Promise<void> => {
    const store = useGuestCartStore.getState();
    store.expireIfNeeded();
    const currentLines = useGuestCartStore.getState().lines;

    if (currentLines.length === 0) {
      setResolvedLines([]);
      setLoadError(false);
      setLoading(false);
      setRevalidating(false);
      return;
    }

    const requestId = ++requestCounterRef.current;
    setRevalidating(true);
    setLoadError(false);
    if (resolvedLines.length === 0) {
      setLoading(true);
    }

    try {
      const response = await quoteCartLines(currentLines);
      if (requestId !== requestCounterRef.current) {
        return;
      }
      recordLoweredFromLines(response.data.lines);
      setResolvedLines(response.data.lines);
      setLoadError(false);
    } catch {
      if (requestId !== requestCounterRef.current) {
        return;
      }
      setLoadError(true);
    } finally {
      if (requestId === requestCounterRef.current) {
        setLoading(false);
        setRevalidating(false);
      }
    }
  }, [recordLoweredFromLines, resolvedLines.length]);

  // Hydrate Zustand persist store strictly after mount to avoid SSR mismatch (AC-9).
  useEffect(() => {
    void useGuestCartStore.persist.rehydrate();
    useGuestCartStore.getState().expireIfNeeded();

    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== GUEST_CART_STORAGE_KEY) {
        return;
      }
      void useGuestCartStore.persist.rehydrate();
      useGuestCartStore.getState().expireIfNeeded();
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const refreshCart = useCallback(async (): Promise<void> => {
    await quoteCurrentGuestCart();
  }, [quoteCurrentGuestCart]);

  const openDrawer = useCallback(
    (triggerEl?: HTMLElement | null) => {
      if (triggerEl !== undefined) {
        setDrawerTriggerEl(triggerEl);
      }
      setDrawerOpen(true);
      void refreshCart();
    },
    [refreshCart],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const addItem = useCallback(
    async (input: AddToCartInput): Promise<void> => {
      if (addingVariantId !== null) {
        return;
      }

      setAddingVariantId(input.variantId);
      try {
        const store = useGuestCartStore.getState();
        store.expireIfNeeded();
        const currentLines = useGuestCartStore.getState().lines;
        const existing = currentLines.find(
          (line) => line.variantId === input.variantId,
        );

        // Full cart check: still validate target availability first to match
        // server outcome evaluation order (UNAVAILABLE before CART_FULL).
        if (!existing && currentLines.length >= CART_MAX_LINES) {
          const check = await quoteCartLines([
            {
              productId: input.productId,
              variantId: input.variantId,
              quantity: 1,
            },
          ]);
          const targetLine = check.data.lines[0];
          if (!targetLine || targetLine.maxQuantity === 0) {
            toast.error(CART_ITEM_UNAVAILABLE_TOAST);
            return;
          }
          toast.error(CART_FULL_TOAST);
          return;
        }

        const nowIso = new Date().toISOString();
        const candidateLines = existing
          ? currentLines.map((line) =>
              line.variantId === input.variantId
                ? {
                    ...line,
                    quantity: Math.min(
                      line.quantity + 1,
                      CART_MAX_LINE_QUANTITY,
                    ),
                  }
                : line,
            )
          : [
              {
                productId: input.productId,
                variantId: input.variantId,
                quantity: 1,
                addedAt: nowIso,
              },
              ...currentLines,
            ];

        const response = await quoteCartLines(candidateLines);
        const quotedLines = response.data.lines;
        const targetQuoted = quotedLines.find(
          (line) => line.variantId === input.variantId,
        );

        if (!targetQuoted || targetQuoted.maxQuantity === 0) {
          toast.error(CART_ITEM_UNAVAILABLE_TOAST);
          return;
        }

        if (existing && existing.quantity >= targetQuoted.maxQuantity) {
          // Shopper already holds the maximum sellable count for this variant.
          recordLoweredFromLines(quotedLines);
          setResolvedLines(quotedLines);
          setLoadError(false);
          setAtLimitVariantId(input.variantId);
          if (input.triggerEl !== undefined) {
            setDrawerTriggerEl(input.triggerEl);
          }
          setDrawerOpen(true);
          announce(
            `You already have the most we can sell of this item (${String(targetQuoted.maxQuantity)})`,
          );
          return;
        }

        // Valid add succeeded: persist to guest store, apply passive lowering
        // on any OTHER lines, open drawer, and announce.
        store.addOrIncrementLine(input.productId, input.variantId, nowIso);

        const otherLowered: Record<string, number> = {};
        for (const line of quotedLines) {
          if (line.variantId !== input.variantId && line.status === "LOWERED") {
            otherLowered[line.variantId] = line.quantity;
          }
        }
        if (Object.keys(otherLowered).length > 0) {
          useGuestCartStore.getState().applyQuoteLowering(otherLowered);
          setLoweredNotices((prev) => ({ ...prev, ...otherLowered }));
        }

        clearLineNotices(input.variantId);
        setResolvedLines(quotedLines);
        setLoadError(false);
        if (input.triggerEl !== undefined) {
          setDrawerTriggerEl(input.triggerEl);
        }
        setDrawerOpen(true);
        announce(`Added ${targetQuoted.title ?? input.title} to your cart`);
      } catch {
        toast.error(CART_UPDATE_ERROR_TOAST);
      } finally {
        setAddingVariantId(null);
      }
    },
    [addingVariantId, announce, clearLineNotices, recordLoweredFromLines],
  );

  const setItemQuantity = useCallback(
    async (variantId: string, quantity: number): Promise<void> => {
      setPendingVariantIds((prev) => new Set(prev).add(variantId));
      try {
        const store = useGuestCartStore.getState();
        store.expireIfNeeded();
        const currentLines = useGuestCartStore.getState().lines;
        const target = currentLines.find(
          (line) => line.variantId === variantId,
        );
        if (!target) {
          return;
        }

        const clampedRequest = Math.max(
          1,
          Math.min(CART_MAX_LINE_QUANTITY, Math.trunc(quantity)),
        );
        const candidateLines = currentLines.map((line) =>
          line.variantId === variantId
            ? { ...line, quantity: clampedRequest }
            : line,
        );

        const response = await quoteCartLines(candidateLines);
        const quotedLines = response.data.lines;
        const targetQuoted = quotedLines.find(
          (line) => line.variantId === variantId,
        );

        if (!targetQuoted || targetQuoted.maxQuantity === 0) {
          setResolvedLines(quotedLines);
          toast.error(CART_ITEM_UNAVAILABLE_TOAST);
          return;
        }

        const effectiveQty = targetQuoted.quantity;
        store.setLineQuantity(variantId, effectiveQty);

        if (targetQuoted.status === "LOWERED") {
          setLoweredNotices((prev) => ({
            ...prev,
            [variantId]: effectiveQty,
          }));
          announce(`Only ${String(effectiveQty)} left, quantity lowered`);
        } else {
          clearLineNotices(variantId);
          announce(
            `Quantity for ${targetQuoted.title ?? "item"} updated to ${String(effectiveQty)}`,
          );
        }

        const otherLowered: Record<string, number> = {};
        for (const line of quotedLines) {
          if (line.variantId !== variantId && line.status === "LOWERED") {
            otherLowered[line.variantId] = line.quantity;
          }
        }
        if (Object.keys(otherLowered).length > 0) {
          useGuestCartStore.getState().applyQuoteLowering(otherLowered);
          setLoweredNotices((prev) => ({ ...prev, ...otherLowered }));
        }

        setResolvedLines(quotedLines);
        setLoadError(false);
      } catch {
        toast.error(CART_UPDATE_ERROR_TOAST);
      } finally {
        setPendingVariantIds((prev) => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    },
    [announce, clearLineNotices],
  );

  const removeItem = useCallback(
    (variantId: string): Promise<void> => {
      setPendingVariantIds((prev) => new Set(prev).add(variantId));
      try {
        const existingTitle =
          resolvedLines.find((line) => line.variantId === variantId)?.title ??
          "item";
        useGuestCartStore.getState().removeLine(variantId);
        clearLineNotices(variantId);
        setResolvedLines((prev) =>
          prev.filter((line) => line.variantId !== variantId),
        );
        announce(`Removed ${existingTitle} from cart`);
      } finally {
        setPendingVariantIds((prev) => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
      return Promise.resolve();
    },
    [announce, clearLineNotices, resolvedLines],
  );

  const clearCart = useCallback((): Promise<boolean> => {
    setClearing(true);
    try {
      useGuestCartStore.getState().clearGuestCart();
      setResolvedLines([]);
      setLoweredNotices({});
      setAtLimitVariantId(null);
      setLoadError(false);
      announce("Your cart is now empty");
      return Promise.resolve(true);
    } finally {
      setClearing(false);
    }
  }, [announce]);

  const dismissMergeBanner = useCallback(() => {
    setMergeAdjustments([]);
  }, []);

  const itemCount = useMemo(() => {
    if (!hydrated) {
      return 0;
    }
    return guestLines.reduce((sum, line) => sum + line.quantity, 0);
  }, [guestLines, hydrated]);

  // Enrich displayed lines with session-memory LOWERED state so subsequent
  // reads keep `Only N left, quantity lowered` visible until edited/removed.
  const lines = useMemo(
    () =>
      resolvedLines.map((line) => {
        if (
          line.status === "OK" &&
          loweredNotices[line.variantId] !== undefined
        ) {
          return { ...line, status: "LOWERED" as const };
        }
        return line;
      }),
    [loweredNotices, resolvedLines],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      mode,
      hydrated,
      itemCount,
      lines,
      loading,
      revalidating,
      loadError,
      drawerOpen,
      addingVariantId,
      pendingVariantIds,
      clearing,
      loweredNotices,
      atLimitVariantId,
      mergeAdjustments,
      announcement,
      drawerTriggerEl,
      openDrawer,
      closeDrawer,
      refreshCart,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      dismissMergeBanner,
    }),
    [
      mode,
      hydrated,
      itemCount,
      lines,
      loading,
      revalidating,
      loadError,
      drawerOpen,
      addingVariantId,
      pendingVariantIds,
      clearing,
      loweredNotices,
      atLimitVariantId,
      mergeAdjustments,
      announcement,
      drawerTriggerEl,
      openDrawer,
      closeDrawer,
      refreshCart,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      dismissMergeBanner,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Returns the active shopping cart context, throwing if used outside
 * {@link CartProvider}.
 */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === null) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}

/**
 * Returns the active shopping cart context, or `null` outside
 * {@link CartProvider} (for example on `(auth)` screens).
 */
export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}
