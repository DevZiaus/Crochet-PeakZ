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
  AuthProvider,
  OAuthProvider,
  OAUTH_ERROR_CODES,
  type OAuthErrorCode,
  type AuthUser,
} from "./types/index.js";
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
} from "./schemas/index.js";
export {
  PASSWORD_MIN_BYTES,
  PASSWORD_MAX_BYTES,
  utf8ByteLength,
  passwordSchema,
  normalizeEmail,
  authEmailSchema,
  authNameSchema,
  registerSchema,
  loginSchema,
  tokenSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  authUserSchema,
  type RegisterInput,
  type LoginInput,
  type ResetPasswordInput,
} from "./schemas/auth.js";
export { sanitizeNextPath, resolvePostSignInPath } from "./auth/next-path.js";
export { CURRENCIES, ORDER_STATUSES } from "./constants/index.js";
