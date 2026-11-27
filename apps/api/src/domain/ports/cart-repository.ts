import type { CartCatalogLookup, CartLineInput } from "../cart/types.js";

/** One persisted item row loaded from `cart_items`. */
export interface PersistedCartItem {
  /** Cart item UUID. */
  id: string;
  /** Product UUID. */
  productId: string;
  /** Variant UUID. */
  variantId: string;
  /** Stored positive quantity (`1..10`). */
  quantity: number;
  /** Timestamp when the line was first added (line ordering key). */
  createdAt: Date;
}

/** Row locked cart aggregate loaded inside a transaction. */
export interface LockedCartRecord {
  /** Cart UUID. */
  id: string;
  /** Owning user UUID. */
  userId: string;
  /** Last merged browser cart id, or `null`. */
  lastMergedGuestCartId: string | null;
  /** Last write timestamp used for lazy 30 day expiry. */
  updatedAt: Date;
  /** Existing cart items ordered newest first. */
  items: PersistedCartItem[];
}

/**
 * Transactional operations exposed inside {@link CartRepository.withLockedCart}.
 *
 * All operations execute on the same PostgreSQL transaction holding the row
 * lock (`FOR UPDATE`) on the user's `carts` row.
 */
export interface CartTransaction {
  /** Snapshot of the locked cart and its items at transaction start. */
  readonly cart: LockedCartRecord;

  /**
   * Batch loads products (including inactive/soft deleted) and variants inside
   * the same transaction so stock checks cannot race with stale reads.
   */
  findCatalogSnapshots(input: {
    productIds: readonly string[];
    variantIds: readonly string[];
  }): Promise<CartCatalogLookup>;

  /**
   * Removes every item from the locked cart.
   *
   * Lazy expiry sets `touchUpdatedAt: false`; an explicit shopper clear sets
   * `touchUpdatedAt: true`.
   */
  deleteAllItems(options: {
    touchUpdatedAt: boolean;
    now: Date;
  }): Promise<void>;

  /**
   * Persists passively lowered item quantities during a read without advancing
   * `carts.updated_at` (AC-7).
   */
  lowerItemQuantitiesSilently(
    updates: readonly { variantId: string; quantity: number }[],
  ): Promise<void>;

  /**
   * Inserts a new cart line or updates an existing line's quantity and
   * advances `carts.updated_at`.
   */
  upsertItem(input: {
    productId: string;
    variantId: string;
    quantity: number;
    createdAt: Date;
    now: Date;
  }): Promise<void>;

  /**
   * Updates one existing line's quantity and advances `carts.updated_at`.
   */
  updateItemQuantity(input: {
    variantId: string;
    quantity: number;
    now: Date;
  }): Promise<void>;

  /**
   * Deletes one line by `variantId` and advances `carts.updated_at` when a row
   * was deleted.
   */
  deleteItem(input: { variantId: string; now: Date }): Promise<boolean>;

  /**
   * Replaces the cart's lines with the merged result, records
   * `lastMergedGuestCartId`, and advances `carts.updated_at` atomically.
   */
  applyMerge(input: {
    guestCartId: string;
    lines: readonly CartLineInput[];
    now: Date;
  }): Promise<void>;
}

/** Persistence port for signed in customer shopping carts. */
export interface CartRepository {
  /**
   * Ensures the user's cart exists (`INSERT ... ON CONFLICT DO NOTHING`),
   * acquires a `SELECT ... FOR UPDATE` row lock on `carts`, loads its items,
   * and executes `work` inside one transaction.
   *
   * @param userId Session user UUID.
   * @param now Current clock time for initial cart creation.
   * @param work Transactional callback.
   * @returns Value returned by `work`.
   */
  withLockedCart<T>(
    userId: string,
    now: Date,
    work: (tx: CartTransaction) => Promise<T>,
  ): Promise<T>;
}
