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
export type {
  CatalogSort,
  CategoryRefDto,
  ProductSummaryDto,
  ProductImageDto,
  ProductVariantDto,
  ProductDetailDto,
  CategorySummaryDto,
  CategoryDetailDto,
  PaginationMetaDto,
  CatalogProductListResponse,
  CatalogProductDetailResponse,
  CatalogCategoryListResponse,
  CatalogCategoryDetailResponse,
} from "./catalog/types.js";
export {
  catalogSortSchema,
  catalogListQuerySchema,
  type CatalogListQuery,
} from "./catalog/schemas.js";
export { calculateVariantPrice } from "./catalog/pricing.js";
export { getStockLabel, getLeadTimeLabel } from "./catalog/labels.js";
export {
  DEFAULT_CONTACT_EMAIL,
  CONTACT_TOPIC_KEYS,
  CONTACT_TOPICS,
  CONTACT_NAME_MIN,
  CONTACT_NAME_MAX,
  CONTACT_EMAIL_MAX,
  CONTACT_MESSAGE_MIN,
  CONTACT_MESSAGE_MAX,
  CONTACT_MIN_FILL_TIME_MS,
  CONTACT_MAX_LINKS,
  CONTACT_MAX_BODY_BYTES,
  isContactTopic,
  contactSubmissionSchema,
  type ContactTopic,
  type ContactSubmissionInput,
} from "./contact/index.js";
export {
  CART_MAX_LINES,
  CART_MAX_LINE_QUANTITY,
  CART_EXPIRY_DAYS,
  CART_EXPIRY_MS,
  CART_MAX_BODY_BYTES,
  CARTABLE_PRODUCT_TYPES,
  isCartableProductType,
  cartUuidSchema,
  cartLineInputSchema,
  cartLinesInputSchema,
  cartQuoteBodySchema,
  cartAddItemBodySchema,
  cartUpdateItemBodySchema,
  cartVariantParamSchema,
  cartMergeBodySchema,
  calculateCartLineTotal,
  calculateCartSubtotal,
  type CartLineStatus,
  type CartAdjustmentKind,
  type AddOutcome,
  type CartLineDto,
  type CartAdjustmentDto,
  type CartDto,
  type CartQuoteResponse,
  type CartResponse,
  type CartAddItemResponse,
  type CartLineInput,
  type CartQuoteBody,
  type CartAddItemBody,
  type CartUpdateItemBody,
  type CartVariantParam,
  type CartMergeBody,
} from "./cart/index.js";
