/**
 * @crochet-peakz/shared
 *
 * Shared types, Zod validation schemas, and constants used across
 * the frontend (apps/web) and backend (apps/api) workspaces.
 */

// Each enum name below exports both the const object and its
// same-named union type; the type modifier is only needed for
// types whose name differs from a value (CurrencyCode).
export {
  Currency,
  type CurrencyCode,
  UserRole,
  ProductType,
  OrderStatus,
  PaymentStatus,
  PaymentGateway,
  DiscountType,
  AddressType,
  CommissionStatus,
} from "./types";
export {
  currencySchema,
  userRoleSchema,
  productTypeSchema,
  orderStatusSchema,
  paymentStatusSchema,
  paymentGatewaySchema,
  discountTypeSchema,
  addressTypeSchema,
  commissionStatusSchema,
} from "./schemas";
export { CURRENCIES, ORDER_STATUSES } from "./constants";
