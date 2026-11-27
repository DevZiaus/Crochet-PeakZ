import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_EXPIRY_MS } from "@crochet-peakz/shared";
import {
  GUEST_CART_STORAGE_KEY,
  GUEST_CART_VERSION,
  createEmptyGuestCart,
  useGuestCartStore,
} from "./guest-cart-store";

const PRODUCT_ID = "0194f3e0-1234-7abc-8def-012345678901";
const VARIANT_ID_1 = "550e8400-e29b-41d4-a716-446655440001";
const VARIANT_ID_2 = "550e8400-e29b-41d4-a716-446655440002";

beforeEach(() => {
  window.localStorage.clear();
  useGuestCartStore.setState(createEmptyGuestCart());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGuestCartStore", () => {
  it("persists under cp_cart v1 without storing prices or currency", () => {
    useGuestCartStore
      .getState()
      .addOrIncrementLine(PRODUCT_ID, VARIANT_ID_1, "2026-11-27T10:00:00.000Z");

    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as {
      version: number;
      state: Record<string, unknown>;
    };
    expect(parsed.version).toBe(GUEST_CART_VERSION);
    expect(parsed.state).not.toHaveProperty("currency");
    const serialized = raw ?? "";
    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("BDT");
    expect(serialized).not.toContain("USD");
  });

  it("resets corrupt JSON or unknown persisted versions silently with a fresh guestCartId", () => {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, "{not valid json");
    void useGuestCartStore.persist.rehydrate();
    expect(useGuestCartStore.getState().lines).toEqual([]);

    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify({
        version: 99,
        state: {
          guestCartId: VARIANT_ID_1,
          updatedAt: new Date().toISOString(),
          lines: [
            {
              productId: PRODUCT_ID,
              variantId: VARIANT_ID_1,
              quantity: 1,
              addedAt: new Date().toISOString(),
            },
          ],
        },
      }),
    );
    void useGuestCartStore.persist.rehydrate();
    expect(useGuestCartStore.getState().lines).toEqual([]);
    expect(useGuestCartStore.getState().guestCartId).not.toBe(VARIANT_ID_1);
  });

  it("expires carts idle for 30 days and rotates guestCartId", () => {
    const oldTime = new Date(Date.now() - CART_EXPIRY_MS - 1000).toISOString();
    const originalId = "550e8400-e29b-41d4-a716-446655440099";

    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify({
        version: GUEST_CART_VERSION,
        state: {
          guestCartId: originalId,
          updatedAt: oldTime,
          lines: [
            {
              productId: PRODUCT_ID,
              variantId: VARIANT_ID_1,
              quantity: 2,
              addedAt: oldTime,
            },
          ],
        },
      }),
    );

    void useGuestCartStore.persist.rehydrate();
    const rotatedId = useGuestCartStore.getState().guestCartId;
    expect(useGuestCartStore.getState().lines).toEqual([]);
    expect(rotatedId).not.toBe(originalId);

    const rawAfter = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    expect(rawAfter).not.toBeNull();
    const persisted = JSON.parse(rawAfter ?? "{}") as {
      version: number;
      state: {
        guestCartId: string;
        updatedAt: string;
        lines: unknown[];
      };
    };
    expect(persisted.version).toBe(GUEST_CART_VERSION);
    expect(persisted.state.lines).toEqual([]);
    expect(persisted.state.guestCartId).toBe(rotatedId);
    expect(persisted.state.guestCartId).not.toBe(originalId);
    expect(persisted.state.updatedAt).not.toBe(oldTime);

    void useGuestCartStore.persist.rehydrate();
    expect(useGuestCartStore.getState().guestCartId).toBe(rotatedId);
  });

  it("lowers quantities passively without advancing updatedAt and rotates guestCartId on clear", () => {
    const initialUpdatedAt = "2026-11-20T09:00:00.000Z";
    const originalId = useGuestCartStore.getState().guestCartId;
    useGuestCartStore.setState({
      guestCartId: originalId,
      updatedAt: initialUpdatedAt,
      lines: [
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID_1,
          quantity: 5,
          addedAt: initialUpdatedAt,
        },
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID_2,
          quantity: 2,
          addedAt: initialUpdatedAt,
        },
      ],
    });

    useGuestCartStore.getState().applyQuoteLowering({ [VARIANT_ID_1]: 2 });

    expect(useGuestCartStore.getState().updatedAt).toBe(initialUpdatedAt);
    expect(
      useGuestCartStore
        .getState()
        .lines.find((l) => l.variantId === VARIANT_ID_1)?.quantity,
    ).toBe(2);

    useGuestCartStore.getState().clearGuestCart();
    expect(useGuestCartStore.getState().lines).toEqual([]);
    expect(useGuestCartStore.getState().guestCartId).not.toBe(originalId);
  });

  it("works in memory when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(() => {
      useGuestCartStore.getState().addOrIncrementLine(PRODUCT_ID, VARIANT_ID_1);
    }).not.toThrow();

    expect(useGuestCartStore.getState().lines).toHaveLength(1);
  });
});
