/**
 * Currency codes supported by Crochet PeakZ.
 * BDT for domestic (Bangladesh) orders, USD for international.
 */
export const Currency = {
  BDT: "BDT",
  USD: "USD",
} as const;

/** Union type of supported currency codes. */
export type CurrencyCode = (typeof Currency)[keyof typeof Currency];

/**
 * Account roles. Mirrors the Prisma `UserRole` enum.
 * CUSTOMER is the default on registration.
 */
export const UserRole = {
  CUSTOMER: "CUSTOMER",
  ADMIN: "ADMIN",
} as const;

/** Union type of account roles. Mirrors the Prisma `UserRole` enum. */
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * The five product kinds the store sells.
 * Mirrors the Prisma `ProductType` enum.
 */
export const ProductType = {
  STANDARD: "STANDARD",
  ONE_OF_A_KIND: "ONE_OF_A_KIND",
  PRE_ORDER: "PRE_ORDER",
  CUSTOM: "CUSTOM",
  DIGITAL: "DIGITAL",
} as const;

/** Union type of product kinds. Mirrors the Prisma `ProductType` enum. */
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

/**
 * Payment state of an order. Mirrors the Prisma `PaymentStatus` enum.
 */
export const PaymentStatus = {
  UNPAID: "UNPAID",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;

/** Union type of payment states. Mirrors the Prisma `PaymentStatus` enum. */
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/**
 * Supported payment gateways. Mirrors the Prisma `PaymentGateway` enum.
 */
export const PaymentGateway = {
  STRIPE: "STRIPE",
  PAYPAL: "PAYPAL",
  SSLCOMMERZ: "SSLCOMMERZ",
  CASH_ON_DELIVERY: "CASH_ON_DELIVERY",
} as const;

/** Union type of payment gateways. Mirrors the Prisma `PaymentGateway` enum. */
export type PaymentGateway =
  (typeof PaymentGateway)[keyof typeof PaymentGateway];

/**
 * How a coupon discount is computed. Mirrors the Prisma `DiscountType` enum.
 */
export const DiscountType = {
  PERCENTAGE: "PERCENTAGE",
  FIXED_AMOUNT: "FIXED_AMOUNT",
} as const;

/** Union type of coupon discount kinds. Mirrors the Prisma `DiscountType` enum. */
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

/**
 * Purpose of a saved address. Mirrors the Prisma `AddressType` enum.
 */
export const AddressType = {
  SHIPPING: "SHIPPING",
  BILLING: "BILLING",
} as const;

/** Union type of address purposes. Mirrors the Prisma `AddressType` enum. */
export type AddressType = (typeof AddressType)[keyof typeof AddressType];

/**
 * Custom commission workflow states. Mirrors the Prisma `CommissionStatus` enum.
 */
export const CommissionStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  QUOTED: "QUOTED",
  ACCEPTED: "ACCEPTED",
  IN_PRODUCTION: "IN_PRODUCTION",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

/** Union type of commission states. Mirrors the Prisma `CommissionStatus` enum. */
export type CommissionStatus =
  (typeof CommissionStatus)[keyof typeof CommissionStatus];

/**
 * How an account was first created. Mirrors the Prisma `AuthProvider` enum.
 * The value records the first sign in method and is never rewritten on link.
 */
export const AuthProvider = {
  LOCAL: "LOCAL",
  GOOGLE: "GOOGLE",
  FACEBOOK: "FACEBOOK",
} as const;

/** Union type of account creation methods. Mirrors the Prisma `AuthProvider` enum. */
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

/**
 * The OAuth providers a customer can sign in with. These values are also the
 * path segment used by the auth routes (`/api/auth/google`).
 */
export const OAuthProvider = {
  GOOGLE: "google",
  FACEBOOK: "facebook",
} as const;

/** Union type of supported OAuth providers. */
export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

/**
 * The failure codes the OAuth result page understands. The API redirects with
 * one of these so the page can show a readable message.
 */
export const OAUTH_ERROR_CODES = [
  "access_denied",
  "email_missing",
  "provider_error",
  "link_failed",
] as const;

/** Union type of OAuth failure codes. */
export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

/**
 * The public shape of a signed in customer. Every user bearing auth response
 * returns exactly these fields, with `null` instead of an omitted value so the
 * web type never drifts from the API.
 */
export interface AuthUser {
  /** Account id (UUID v7). */
  id: string;
  /** Display name. */
  name: string;
  /** Email address, stored trimmed and lowercased. */
  email: string;
  /** Account role. */
  role: UserRole;
  /** Avatar URL, or null when the account has none. */
  avatarUrl: string | null;
  /** Whether the email address has been verified. */
  emailVerified: boolean;
}

/**
 * Order status lifecycle states. Mirrors the Prisma `OrderStatus` enum.
 * Orders move through these stages from placement to completion.
 */
export const OrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  HANDCRAFTING: "HANDCRAFTING",
  READY_TO_SHIP: "READY_TO_SHIP",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;

/** Union type of order status lifecycle states. Mirrors the Prisma `OrderStatus` enum. */
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
