import { z } from "zod";
import {
  Currency,
  UserRole,
  ProductType,
  OrderStatus,
  PaymentStatus,
  PaymentGateway,
  DiscountType,
  AddressType,
  CommissionStatus,
} from "../types/index";

/**
 * Zod schema for validating currency codes.
 * Accepts only "BDT" or "USD".
 */
export const currencySchema = z.enum([Currency.BDT, Currency.USD]);

/**
 * Zod schema for validating account roles.
 * Mirrors the Prisma `UserRole` enum.
 */
export const userRoleSchema = z.enum([UserRole.CUSTOMER, UserRole.ADMIN]);

/**
 * Zod schema for validating product kinds.
 * Mirrors the Prisma `ProductType` enum.
 */
export const productTypeSchema = z.enum([
  ProductType.STANDARD,
  ProductType.ONE_OF_A_KIND,
  ProductType.PRE_ORDER,
  ProductType.CUSTOM,
  ProductType.DIGITAL,
]);

/**
 * Zod schema for validating order statuses.
 * Mirrors the Prisma `OrderStatus` enum.
 */
export const orderStatusSchema = z.enum([
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.HANDCRAFTING,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
]);

/**
 * Zod schema for validating payment statuses.
 * Mirrors the Prisma `PaymentStatus` enum.
 */
export const paymentStatusSchema = z.enum([
  PaymentStatus.UNPAID,
  PaymentStatus.PAID,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
]);

/**
 * Zod schema for validating payment gateway names.
 * Mirrors the Prisma `PaymentGateway` enum.
 */
export const paymentGatewaySchema = z.enum([
  PaymentGateway.STRIPE,
  PaymentGateway.PAYPAL,
  PaymentGateway.SSLCOMMERZ,
  PaymentGateway.CASH_ON_DELIVERY,
]);

/**
 * Zod schema for validating coupon discount kinds.
 * Mirrors the Prisma `DiscountType` enum.
 */
export const discountTypeSchema = z.enum([
  DiscountType.PERCENTAGE,
  DiscountType.FIXED_AMOUNT,
]);

/**
 * Zod schema for validating address purposes.
 * Mirrors the Prisma `AddressType` enum.
 */
export const addressTypeSchema = z.enum([
  AddressType.SHIPPING,
  AddressType.BILLING,
]);

/**
 * Zod schema for validating commission workflow states.
 * Mirrors the Prisma `CommissionStatus` enum.
 */
export const commissionStatusSchema = z.enum([
  CommissionStatus.PENDING_REVIEW,
  CommissionStatus.QUOTED,
  CommissionStatus.ACCEPTED,
  CommissionStatus.IN_PRODUCTION,
  CommissionStatus.COMPLETED,
  CommissionStatus.CANCELLED,
]);
