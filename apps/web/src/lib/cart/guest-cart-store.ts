import { create } from "zustand";
import {
  persist,
  type PersistStorage,
  type StorageValue,
} from "zustand/middleware";
import {
  CART_EXPIRY_MS,
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  cartUuidSchema,
} from "@crochet-peakz/shared";

/** LocalStorage key holding the visitor cart state. */
export const GUEST_CART_STORAGE_KEY = "cp_cart";

/** Persisted schema version for the visitor cart. */
export const GUEST_CART_VERSION = 1;

/** One line saved in the browser cart. Never holds prices or currency. */
export interface GuestCartLine {
  /** Product UUID. */
  productId: string;
  /** Variant UUID. */
  variantId: string;
  /** Saved positive integer quantity (`1..10`). */
  quantity: number;
  /** ISO timestamp when this line was first added. */
  addedAt: string;
}

/** Persisted slice of the visitor cart store. */
export interface GuestCartPersistedState {
  /** Unique identifier rotated on clear or expiry for idempotent merge. */
  guestCartId: string;
  /** ISO timestamp of the last explicit shopper write (used for 30 day expiry). */
  updatedAt: string;
  /** Saved browser cart lines. */
  lines: GuestCartLine[];
}

/** Full Zustand store interface for the visitor cart. */
export interface GuestCartStore extends GuestCartPersistedState {
  /** Ensures an expired cart resets cleanly before any read or write. */
  expireIfNeeded: (nowMs?: number) => boolean;
  /** Adds a new variant at qty 1 or increments an existing variant by 1. */
  addOrIncrementLine: (
    productId: string,
    variantId: string,
    addedAt?: string,
  ) => void;
  /** Sets the saved quantity for an existing variant, bumping `updatedAt`. */
  setLineQuantity: (variantId: string, quantity: number) => void;
  /**
   * Persists passive stock lowering from a quote response without bumping
   * `updatedAt`, so passive reads never extend the 30 day expiry window.
   */
  applyQuoteLowering: (
    loweredByVariantId: Readonly<Record<string, number>>,
  ) => void;
  /** Removes one variant line, bumping `updatedAt`. */
  removeLine: (variantId: string) => void;
  /** Empties all lines and rotates `guestCartId` to a fresh UUID. */
  clearGuestCart: () => void;
}

/**
 * Generates a fresh RFC 4122 UUID for `guestCartId`.
 */
export function generateGuestCartId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback for environments without randomUUID.
  const bytes = new Uint8Array(16);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < 16; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Builds a clean empty visitor cart state with a fresh `guestCartId`. */
export function createEmptyGuestCart(
  nowIso = new Date().toISOString(),
): GuestCartPersistedState {
  return {
    guestCartId: generateGuestCartId(),
    updatedAt: nowIso,
    lines: [],
  };
}

/** Checks whether a persisted `updatedAt` timestamp is older than 30 days. */
export function isGuestCartExpired(
  updatedAt: string,
  nowMs = Date.now(),
): boolean {
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed)) {
    return true;
  }
  return nowMs - parsed >= CART_EXPIRY_MS;
}

/**
 * Validates and sanitizes an unknown parsed payload from storage.
 * Returns `null` when corrupt, wrong version, or structurally invalid.
 */
function parsePersistedState(
  raw: string,
  nowMs = Date.now(),
): StorageValue<GuestCartPersistedState> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (record.version !== GUEST_CART_VERSION) {
    return null;
  }

  const state = record.state;
  if (typeof state !== "object" || state === null) {
    return null;
  }

  const stateRecord = state as Record<string, unknown>;
  const guestCartId = stateRecord.guestCartId;
  const updatedAt = stateRecord.updatedAt;
  const lines = stateRecord.lines;

  if (
    typeof guestCartId !== "string" ||
    !cartUuidSchema.safeParse(guestCartId).success ||
    typeof updatedAt !== "string" ||
    !Number.isFinite(Date.parse(updatedAt)) ||
    !Array.isArray(lines) ||
    lines.length > CART_MAX_LINES
  ) {
    return null;
  }

  if (isGuestCartExpired(updatedAt, nowMs)) {
    return {
      state: createEmptyGuestCart(new Date(nowMs).toISOString()),
      version: GUEST_CART_VERSION,
    };
  }

  const seenVariants = new Set<string>();
  const validLines: GuestCartLine[] = [];

  for (const item of lines) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const line = item as Record<string, unknown>;
    if (
      typeof line.productId !== "string" ||
      !cartUuidSchema.safeParse(line.productId).success ||
      typeof line.variantId !== "string" ||
      !cartUuidSchema.safeParse(line.variantId).success ||
      typeof line.quantity !== "number" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > CART_MAX_LINE_QUANTITY ||
      typeof line.addedAt !== "string" ||
      !Number.isFinite(Date.parse(line.addedAt)) ||
      seenVariants.has(line.variantId)
    ) {
      return null;
    }

    seenVariants.add(line.variantId);
    validLines.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      addedAt: line.addedAt,
    });
  }

  return {
    state: {
      guestCartId,
      updatedAt,
      lines: validLines,
    },
    version: GUEST_CART_VERSION,
  };
}

/** In memory fallback used when `localStorage` is unavailable or throws. */
const memoryFallback = new Map<string, string>();

/** Reads raw string storage with silent fallback to in memory storage. */
function safeGetRaw(name: string): string | null {
  try {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(name);
    }
  } catch {
    // Fall back to in memory storage when localStorage is blocked.
  }
  return memoryFallback.get(name) ?? null;
}

/** Writes raw string storage with silent fallback to in memory storage. */
function safeSetRaw(name: string, value: string): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(name, value);
      return;
    }
  } catch {
    // Fall back to in memory storage when localStorage throws (quota/private).
  }
  memoryFallback.set(name, value);
}

/** Removes raw string storage with silent fallback to in memory storage. */
function safeRemoveRaw(name: string): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(name);
      return;
    }
  } catch {
    // Fall back to in memory storage.
  }
  memoryFallback.delete(name);
}

/**
 * Custom Zustand PersistStorage that validates JSON, resets corrupt or unknown
 * versions silently, enforces 30 day expiry on read, and falls back to memory
 * when `localStorage` is unavailable.
 */
const guestCartStorage: PersistStorage<GuestCartPersistedState> = {
  getItem(name) {
    const raw = safeGetRaw(name);
    if (raw === null) {
      return null;
    }
    const parsed = parsePersistedState(raw);
    if (parsed === null) {
      const fresh: StorageValue<GuestCartPersistedState> = {
        state: createEmptyGuestCart(),
        version: GUEST_CART_VERSION,
      };
      safeSetRaw(name, JSON.stringify(fresh));
      return fresh;
    }
    return parsed;
  },
  setItem(name, value) {
    safeSetRaw(name, JSON.stringify(value));
  },
  removeItem(name) {
    safeRemoveRaw(name);
  },
};

/**
 * Zustand store holding the visitor browser cart persisted under `cp_cart`.
 *
 * Uses `skipHydration: true` so the first client render matches SSR (count 0);
 * `CartProvider` triggers `rehydrate()` inside `useEffect`.
 */
export const useGuestCartStore = create<GuestCartStore>()(
  persist(
    (set, get) => ({
      ...createEmptyGuestCart(),

      expireIfNeeded(nowMs = Date.now()) {
        const current = get();
        if (
          current.lines.length > 0 &&
          isGuestCartExpired(current.updatedAt, nowMs)
        ) {
          set(createEmptyGuestCart(new Date(nowMs).toISOString()));
          return true;
        }
        return false;
      },

      addOrIncrementLine(
        productId,
        variantId,
        addedAt = new Date().toISOString(),
      ) {
        const nowIso = new Date().toISOString();
        const current = get();
        const baseLines = isGuestCartExpired(current.updatedAt)
          ? []
          : current.lines;
        const baseGuestCartId = isGuestCartExpired(current.updatedAt)
          ? generateGuestCartId()
          : current.guestCartId;

        const existingIndex = baseLines.findIndex(
          (line) => line.variantId === variantId,
        );

        if (existingIndex >= 0) {
          const existing = baseLines[existingIndex];
          if (!existing || existing.quantity >= CART_MAX_LINE_QUANTITY) {
            return;
          }
          const nextLines = baseLines.map((line, index) =>
            index === existingIndex
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          );
          set({
            guestCartId: baseGuestCartId,
            updatedAt: nowIso,
            lines: nextLines,
          });
          return;
        }

        if (baseLines.length >= CART_MAX_LINES) {
          return;
        }

        set({
          guestCartId: baseGuestCartId,
          updatedAt: nowIso,
          lines: [{ productId, variantId, quantity: 1, addedAt }, ...baseLines],
        });
      },

      setLineQuantity(variantId, quantity) {
        const clamped = Math.max(
          1,
          Math.min(CART_MAX_LINE_QUANTITY, Math.trunc(quantity)),
        );
        const current = get();
        const exists = current.lines.some(
          (line) => line.variantId === variantId,
        );
        if (!exists) {
          return;
        }
        set({
          updatedAt: new Date().toISOString(),
          lines: current.lines.map((line) =>
            line.variantId === variantId
              ? { ...line, quantity: clamped }
              : line,
          ),
        });
      },

      applyQuoteLowering(loweredByVariantId) {
        const current = get();
        let changed = false;
        const nextLines: GuestCartLine[] = [];

        for (const line of current.lines) {
          const lowered = loweredByVariantId[line.variantId];
          if (
            lowered !== undefined &&
            lowered >= 1 &&
            lowered < line.quantity
          ) {
            changed = true;
            nextLines.push({ ...line, quantity: lowered });
          } else {
            nextLines.push(line);
          }
        }

        if (changed) {
          // Deliberately do NOT update `updatedAt` on passive quote lowering.
          set({ lines: nextLines });
        }
      },

      removeLine(variantId) {
        const current = get();
        const nextLines = current.lines.filter(
          (line) => line.variantId !== variantId,
        );
        if (nextLines.length === current.lines.length) {
          return;
        }
        set({
          updatedAt: new Date().toISOString(),
          lines: nextLines,
        });
      },

      clearGuestCart() {
        set(createEmptyGuestCart());
      },
    }),
    {
      name: GUEST_CART_STORAGE_KEY,
      version: GUEST_CART_VERSION,
      skipHydration: true,
      storage: guestCartStorage,
      partialize: (state) => ({
        guestCartId: state.guestCartId,
        updatedAt: state.updatedAt,
        lines: state.lines,
      }),
    },
  ),
);
