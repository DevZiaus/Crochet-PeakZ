/**
 * Currency display metadata.
 * Maps currency codes to their symbols and display names.
 */
export const CURRENCIES = {
  BDT: { symbol: "৳", name: "Bangladeshi Taka" },
  USD: { symbol: "$", name: "US Dollar" },
} as const;

/**
 * Order status progression for iteration.
 * Note: OrderStatus enum is defined in types/index.ts for consistency
 * with other Prisma enums.
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
