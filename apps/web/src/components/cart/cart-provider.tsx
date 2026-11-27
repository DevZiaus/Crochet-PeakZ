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
import {
  CartApiError,
  addAccountCartItem,
  clearAccountCart,
  fetchAccountCart,
  mergeGuestCart,
  quoteCartLines,
  removeAccountCartItem,
  updateAccountCartItem,
} from "@/lib/cart/api";
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

/** BroadcastChannel topic keeping account carts aligned across open tabs. */
export const CART_BROADCAST_CHANNEL = "cp_cart";

/** Unique identifier for this browser tab so BroadcastChannel ignores self echoes. */
const TAB_INSTANCE_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : String(Math.random());

/** Message broadcast across open tabs after an account cart mutation. */
interface CartSyncMessage {
  type: "sync";
  userId: string;
  senderId: string;
}

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

/** Posts a cross tab sync notice for signed in account mutations. */
function broadcastAccountSync(userId: string): void {
  if (typeof BroadcastChannel === "undefined") {
    return;
  }
  try {
    const channel = new BroadcastChannel(CART_BROADCAST_CHANNEL);
    const message: CartSyncMessage = {
      type: "sync",
      userId,
      senderId: TAB_INSTANCE_ID,
    };
    channel.postMessage(message);
    channel.close();
  } catch {
    // Ignore environments where BroadcastChannel is blocked.
  }
}

/**
 * Provides hybrid shopping cart state across the storefront shell.
 *
 * Visitors keep their cart in Zustand + `localStorage` (`cp_cart`) validated
 * via `POST /api/cart/quote`. Signed in customers use the server `/api/cart`
 * API with `BroadcastChannel("cp_cart")` and `visibilitychange` sync.
 */
export function CartProvider({ children }: CartProviderProps) {
  const { user, loading: sessionLoading, refreshSession } = useSession();
  const activeUserId = !sessionLoading && user !== null ? user.id : null;
  const mode: CartMode = activeUserId !== null ? "account" : "visitor";

  const guestLines = useGuestCartStore((state) => state.lines);

  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrated,
    getServerHydrated,
  );
  const [resolvedLines, setResolvedLines] = useState<CartLineDto[]>([]);
  const [accountLoaded, setAccountLoaded] = useState(false);
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
  const hasResolvedLinesRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  const updateResolvedLines = useCallback((nextLines: CartLineDto[]) => {
    hasResolvedLinesRef.current = nextLines.length > 0;
    setResolvedLines(nextLines);
  }, []);

  const announce = useCallback((message: string) => {
    setAnnouncement("");
    queueMicrotask(() => {
      setAnnouncement(message);
    });
  }, []);

  const recordLoweredFromLines = useCallback(
    (nextLines: readonly CartLineDto[], persistToGuestStore: boolean) => {
      const newlyLowered: Record<string, number> = {};
      for (const line of nextLines) {
        if (line.status === "LOWERED") {
          newlyLowered[line.variantId] = line.quantity;
        }
      }
      if (Object.keys(newlyLowered).length > 0) {
        if (persistToGuestStore) {
          useGuestCartStore.getState().applyQuoteLowering(newlyLowered);
        }
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

  const handleUnauthorized = useCallback(
    (error: unknown): boolean => {
      if (error instanceof CartApiError && error.status === 401) {
        void refreshSession?.();
        return true;
      }
      return false;
    },
    [refreshSession],
  );

  const quoteCurrentGuestCart = useCallback(async (): Promise<void> => {
    if (!useGuestCartStore.persist.hasHydrated()) {
      void useGuestCartStore.persist.rehydrate();
    }
    const store = useGuestCartStore.getState();
    store.expireIfNeeded();
    const currentLines = useGuestCartStore.getState().lines;

    if (currentLines.length === 0) {
      updateResolvedLines([]);
      setLoadError(false);
      setLoading(false);
      setRevalidating(false);
      return;
    }

    const requestId = ++requestCounterRef.current;
    setRevalidating(true);
    setLoadError(false);
    if (!hasResolvedLinesRef.current) {
      setLoading(true);
    }

    try {
      const response = await quoteCartLines(currentLines);
      if (requestId !== requestCounterRef.current) {
        return;
      }
      recordLoweredFromLines(response.data.lines, true);
      updateResolvedLines(response.data.lines);
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
  }, [recordLoweredFromLines, updateResolvedLines]);

  const loadAccountCart = useCallback(
    async (showSkeleton: boolean): Promise<void> => {
      const requestId = ++requestCounterRef.current;
      setRevalidating(true);
      setLoadError(false);
      if (showSkeleton) {
        setLoading(true);
      }

      try {
        const response = await fetchAccountCart();
        if (requestId !== requestCounterRef.current) {
          return;
        }
        recordLoweredFromLines(response.data.lines, false);
        updateResolvedLines(response.data.lines);
        setAccountLoaded(true);
        setLoadError(false);
      } catch (error) {
        if (requestId !== requestCounterRef.current) {
          return;
        }
        if (handleUnauthorized(error)) {
          return;
        }
        setLoadError(true);
      } finally {
        if (requestId === requestCounterRef.current) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    [handleUnauthorized, recordLoweredFromLines, updateResolvedLines],
  );

  const syncOrMergeAccountCart = useCallback(
    async (userId: string, showSkeleton: boolean): Promise<void> => {
      if (!useGuestCartStore.persist.hasHydrated()) {
        void useGuestCartStore.persist.rehydrate();
      }
      useGuestCartStore.getState().expireIfNeeded();
      const { guestCartId, lines: localLines } = useGuestCartStore.getState();

      if (localLines.length === 0) {
        await loadAccountCart(showSkeleton);
        return;
      }

      const requestId = ++requestCounterRef.current;
      setRevalidating(true);
      setLoadError(false);
      if (showSkeleton) {
        setLoading(true);
      }

      try {
        const response = await mergeGuestCart({
          guestCartId,
          lines: localLines,
        });
        if (requestId !== requestCounterRef.current) {
          return;
        }

        // Clear local browser cart and rotate guestCartId ONLY after merge succeeds (AC-11).
        useGuestCartStore.getState().clearGuestCart();
        recordLoweredFromLines(response.data.lines, false);
        updateResolvedLines(response.data.lines);
        setAccountLoaded(true);
        setLoadError(false);
        broadcastAccountSync(userId);

        if (response.data.adjustments.length > 0) {
          setMergeAdjustments(response.data.adjustments);
          setDrawerOpen(true);
          announce("Some items in your cart changed when you signed in");
        }
      } catch (error) {
        if (requestId !== requestCounterRef.current) {
          return;
        }
        if (handleUnauthorized(error)) {
          return;
        }
        // Keep browser cart intact so the next load or retry merges it (AC-11).
        setLoadError(true);
      } finally {
        if (requestId === requestCounterRef.current) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    [
      announce,
      handleUnauthorized,
      loadAccountCart,
      recordLoweredFromLines,
      updateResolvedLines,
    ],
  );

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

  // Coordinate session transitions between visitor and account mode (AC-10, AC-11, AC-12).
  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    const prevUserId = previousUserIdRef.current;
    previousUserIdRef.current = activeUserId;

    if (activeUserId !== null) {
      if (prevUserId !== activeUserId) {
        let cancelled = false;
        queueMicrotask(() => {
          if (cancelled) {
            return;
          }
          updateResolvedLines([]);
          setAccountLoaded(false);
          setLoweredNotices({});
          setAtLimitVariantId(null);
          void syncOrMergeAccountCart(activeUserId, true);
        });
        return () => {
          cancelled = true;
        };
      }
      return;
    }

    // Signed out: drop account lines from memory immediately and show an empty
    // browser cart with a fresh guestCartId while leaving server cart intact (AC-12).
    if (prevUserId !== null) {
      requestCounterRef.current += 1;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        useGuestCartStore.getState().clearGuestCart();
        updateResolvedLines([]);
        setAccountLoaded(false);
        setLoweredNotices({});
        setAtLimitVariantId(null);
        setMergeAdjustments([]);
        setLoadError(false);
        setLoading(false);
        setRevalidating(false);
      });
      return () => {
        cancelled = true;
      };
    }

    return;
  }, [
    activeUserId,
    sessionLoading,
    syncOrMergeAccountCart,
    updateResolvedLines,
  ]);

  // Cross tab BroadcastChannel + tab focus sync for signed in accounts (AC-10).
  useEffect(() => {
    if (activeUserId === null) {
      return;
    }

    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void loadAccountCart(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(CART_BROADCAST_CHANNEL);
        channel.onmessage = (event: MessageEvent<unknown>) => {
          const data = event.data as Partial<CartSyncMessage> | null;
          if (
            data?.type === "sync" &&
            data.userId === activeUserId &&
            data.senderId !== TAB_INSTANCE_ID
          ) {
            void loadAccountCart(false);
          }
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      channel?.close();
    };
  }, [activeUserId, loadAccountCart]);

  const refreshCart = useCallback(async (): Promise<void> => {
    if (activeUserId !== null) {
      await syncOrMergeAccountCart(
        activeUserId,
        !accountLoaded && !hasResolvedLinesRef.current,
      );
      return;
    }
    await quoteCurrentGuestCart();
  }, [
    accountLoaded,
    activeUserId,
    quoteCurrentGuestCart,
    syncOrMergeAccountCart,
  ]);

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
        if (activeUserId !== null) {
          const response = await addAccountCartItem({
            productId: input.productId,
            variantId: input.variantId,
          });

          recordLoweredFromLines(response.data.lines, false);
          updateResolvedLines(response.data.lines);
          setAccountLoaded(true);
          setLoadError(false);

          if (response.outcome === "UNAVAILABLE") {
            toast.error(CART_ITEM_UNAVAILABLE_TOAST);
            return;
          }
          if (response.outcome === "CART_FULL") {
            toast.error(CART_FULL_TOAST);
            return;
          }

          const targetLine = response.data.lines.find(
            (line) => line.variantId === input.variantId,
          );

          if (response.outcome === "AT_LIMIT") {
            setAtLimitVariantId(input.variantId);
            if (input.triggerEl !== undefined) {
              setDrawerTriggerEl(input.triggerEl);
            }
            setDrawerOpen(true);
            announce(
              `You already have the most we can sell of this item (${String(targetLine?.maxQuantity ?? 1)})`,
            );
            return;
          }

          clearLineNotices(input.variantId);
          broadcastAccountSync(activeUserId);
          if (input.triggerEl !== undefined) {
            setDrawerTriggerEl(input.triggerEl);
          }
          setDrawerOpen(true);
          announce(`Added ${targetLine?.title ?? input.title} to your cart`);
          return;
        }

        // Visitor mode
        const store = useGuestCartStore.getState();
        store.expireIfNeeded();
        const currentLines = useGuestCartStore.getState().lines;
        const existing = currentLines.find(
          (line) => line.variantId === input.variantId,
        );

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
          recordLoweredFromLines(quotedLines, true);
          updateResolvedLines(quotedLines);
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
        updateResolvedLines(quotedLines);
        setLoadError(false);
        if (input.triggerEl !== undefined) {
          setDrawerTriggerEl(input.triggerEl);
        }
        setDrawerOpen(true);
        announce(`Added ${targetQuoted.title ?? input.title} to your cart`);
      } catch (error) {
        if (!handleUnauthorized(error)) {
          toast.error(CART_UPDATE_ERROR_TOAST);
        }
      } finally {
        setAddingVariantId(null);
      }
    },
    [
      activeUserId,
      addingVariantId,
      announce,
      clearLineNotices,
      handleUnauthorized,
      recordLoweredFromLines,
      updateResolvedLines,
    ],
  );

  const setItemQuantity = useCallback(
    async (variantId: string, quantity: number): Promise<void> => {
      setPendingVariantIds((prev) => new Set(prev).add(variantId));
      try {
        const clampedRequest = Math.max(
          1,
          Math.min(CART_MAX_LINE_QUANTITY, Math.trunc(quantity)),
        );

        if (activeUserId !== null) {
          const response = await updateAccountCartItem(
            variantId,
            clampedRequest,
          );
          const updatedLines = response.data.lines;
          const targetLine = updatedLines.find(
            (line) => line.variantId === variantId,
          );

          recordLoweredFromLines(updatedLines, false);
          if (targetLine?.status === "LOWERED") {
            setLoweredNotices((prev) => ({
              ...prev,
              [variantId]: targetLine.quantity,
            }));
            announce(
              `Only ${String(targetLine.quantity)} left, quantity lowered`,
            );
          } else {
            clearLineNotices(variantId);
            announce(
              `Quantity for ${targetLine?.title ?? "item"} updated to ${String(targetLine?.quantity ?? clampedRequest)}`,
            );
          }

          updateResolvedLines(updatedLines);
          setLoadError(false);
          broadcastAccountSync(activeUserId);
          return;
        }

        // Visitor mode
        const store = useGuestCartStore.getState();
        store.expireIfNeeded();
        const currentLines = useGuestCartStore.getState().lines;
        const target = currentLines.find(
          (line) => line.variantId === variantId,
        );
        if (!target) {
          return;
        }

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
          updateResolvedLines(quotedLines);
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

        updateResolvedLines(quotedLines);
        setLoadError(false);
      } catch (error) {
        if (
          error instanceof CartApiError &&
          error.status === 409 &&
          error.code === "ITEM_UNAVAILABLE"
        ) {
          if (error.cartData) {
            updateResolvedLines(error.cartData.lines);
          }
          toast.error(CART_ITEM_UNAVAILABLE_TOAST);
        } else if (!handleUnauthorized(error)) {
          toast.error(CART_UPDATE_ERROR_TOAST);
        }
      } finally {
        setPendingVariantIds((prev) => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    },
    [
      activeUserId,
      announce,
      clearLineNotices,
      handleUnauthorized,
      recordLoweredFromLines,
      updateResolvedLines,
    ],
  );

  const removeItem = useCallback(
    async (variantId: string): Promise<void> => {
      setPendingVariantIds((prev) => new Set(prev).add(variantId));
      try {
        const existingTitle =
          resolvedLines.find((line) => line.variantId === variantId)?.title ??
          "item";

        if (activeUserId !== null) {
          const response = await removeAccountCartItem(variantId);
          clearLineNotices(variantId);
          recordLoweredFromLines(response.data.lines, false);
          updateResolvedLines(response.data.lines);
          setLoadError(false);
          broadcastAccountSync(activeUserId);
          announce(`Removed ${existingTitle} from cart`);
          return;
        }

        useGuestCartStore.getState().removeLine(variantId);
        clearLineNotices(variantId);
        const remaining = resolvedLines.filter(
          (line) => line.variantId !== variantId,
        );
        updateResolvedLines(remaining);
        announce(`Removed ${existingTitle} from cart`);
      } catch (error) {
        if (!handleUnauthorized(error)) {
          toast.error(CART_UPDATE_ERROR_TOAST);
        }
      } finally {
        setPendingVariantIds((prev) => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    },
    [
      activeUserId,
      announce,
      clearLineNotices,
      handleUnauthorized,
      recordLoweredFromLines,
      resolvedLines,
      updateResolvedLines,
    ],
  );

  const clearCart = useCallback(async (): Promise<boolean> => {
    setClearing(true);
    try {
      if (activeUserId !== null) {
        await clearAccountCart();
        updateResolvedLines([]);
        setLoweredNotices({});
        setAtLimitVariantId(null);
        setLoadError(false);
        broadcastAccountSync(activeUserId);
        announce("Your cart is now empty");
        return true;
      }

      useGuestCartStore.getState().clearGuestCart();
      updateResolvedLines([]);
      setLoweredNotices({});
      setAtLimitVariantId(null);
      setLoadError(false);
      announce("Your cart is now empty");
      return true;
    } catch (error) {
      if (!handleUnauthorized(error)) {
        toast.error(CART_UPDATE_ERROR_TOAST);
      }
      return false;
    } finally {
      setClearing(false);
    }
  }, [activeUserId, announce, handleUnauthorized, updateResolvedLines]);

  const dismissMergeBanner = useCallback(() => {
    setMergeAdjustments([]);
  }, []);

  const itemCount = useMemo(() => {
    if (!hydrated) {
      return 0;
    }
    if (activeUserId !== null) {
      return resolvedLines.reduce((sum, line) => sum + line.quantity, 0);
    }
    return guestLines.reduce((sum, line) => sum + line.quantity, 0);
  }, [activeUserId, guestLines, hydrated, resolvedLines]);

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

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Page level polite live region active whenever the drawer is closed (AC-17). */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {drawerOpen ? "" : announcement}
      </div>
    </CartContext.Provider>
  );
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
