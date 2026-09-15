/**
 * Currency display metadata.
 * Maps currency codes to their symbols and display names.
 */
export const CURRENCIES = {
  BDT: { symbol: "৳", name: "Bangladeshi Taka" },
  USD: { symbol: "$", name: "US Dollar" },
} as const;

/**
 * Order status progression.
 * Orders move through these stages from placement to completion.
 */
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "HANDCRAFTING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

/** Union type of valid order statuses. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];
