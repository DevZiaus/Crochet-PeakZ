import { describe, it, expect } from "vitest";
import {
  currencySchema,
  userRoleSchema,
  productTypeSchema,
  orderStatusSchema,
  paymentStatusSchema,
  paymentGatewaySchema,
  discountTypeSchema,
  addressTypeSchema,
  commissionStatusSchema,
} from "./index.js";
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
} from "../types/index.js";

describe("Zod Schemas", () => {
  it("currencySchema validates valid currencies (AC-11)", () => {
    expect(currencySchema.parse("BDT")).toBe(Currency.BDT);
    expect(currencySchema.parse("USD")).toBe(Currency.USD);
  });

  it("currencySchema rejects invalid currencies", () => {
    expect(() => currencySchema.parse("EUR")).toThrow();
  });

  it("userRoleSchema validates valid roles (AC-11)", () => {
    expect(userRoleSchema.parse("CUSTOMER")).toBe(UserRole.CUSTOMER);
    expect(userRoleSchema.parse("ADMIN")).toBe(UserRole.ADMIN);
  });

  it("userRoleSchema rejects invalid roles", () => {
    expect(() => userRoleSchema.parse("SUPERADMIN")).toThrow();
  });

  it("productTypeSchema validates valid product types (AC-11)", () => {
    expect(productTypeSchema.parse("STANDARD")).toBe(ProductType.STANDARD);
    expect(productTypeSchema.parse("ONE_OF_A_KIND")).toBe(
      ProductType.ONE_OF_A_KIND,
    );
    expect(productTypeSchema.parse("PRE_ORDER")).toBe(ProductType.PRE_ORDER);
    expect(productTypeSchema.parse("CUSTOM")).toBe(ProductType.CUSTOM);
    expect(productTypeSchema.parse("DIGITAL")).toBe(ProductType.DIGITAL);
  });

  it("productTypeSchema rejects invalid product types", () => {
    expect(() => productTypeSchema.parse("UNKNOWN")).toThrow();
  });

  it("orderStatusSchema validates valid order statuses (AC-11)", () => {
    expect(orderStatusSchema.parse("PENDING_PAYMENT")).toBe(
      OrderStatus.PENDING_PAYMENT,
    );
    expect(orderStatusSchema.parse("CONFIRMED")).toBe(OrderStatus.CONFIRMED);
    expect(orderStatusSchema.parse("PROCESSING")).toBe(OrderStatus.PROCESSING);
    expect(orderStatusSchema.parse("HANDCRAFTING")).toBe(
      OrderStatus.HANDCRAFTING,
    );
    expect(orderStatusSchema.parse("READY_TO_SHIP")).toBe(
      OrderStatus.READY_TO_SHIP,
    );
    expect(orderStatusSchema.parse("SHIPPED")).toBe(OrderStatus.SHIPPED);
    expect(orderStatusSchema.parse("DELIVERED")).toBe(OrderStatus.DELIVERED);
    expect(orderStatusSchema.parse("CANCELLED")).toBe(OrderStatus.CANCELLED);
    expect(orderStatusSchema.parse("REFUNDED")).toBe(OrderStatus.REFUNDED);
  });

  it("orderStatusSchema rejects invalid order statuses", () => {
    expect(() => orderStatusSchema.parse("INVALID_STATE")).toThrow();
  });

  it("paymentStatusSchema validates valid payment statuses (AC-11)", () => {
    expect(paymentStatusSchema.parse("UNPAID")).toBe(PaymentStatus.UNPAID);
    expect(paymentStatusSchema.parse("PAID")).toBe(PaymentStatus.PAID);
    expect(paymentStatusSchema.parse("FAILED")).toBe(PaymentStatus.FAILED);
    expect(paymentStatusSchema.parse("REFUNDED")).toBe(PaymentStatus.REFUNDED);
  });

  it("paymentStatusSchema rejects invalid payment statuses", () => {
    expect(() => paymentStatusSchema.parse("PENDING")).toThrow();
  });

  it("paymentGatewaySchema validates valid payment gateways (AC-11)", () => {
    expect(paymentGatewaySchema.parse("STRIPE")).toBe(PaymentGateway.STRIPE);
    expect(paymentGatewaySchema.parse("PAYPAL")).toBe(PaymentGateway.PAYPAL);
    expect(paymentGatewaySchema.parse("SSLCOMMERZ")).toBe(
      PaymentGateway.SSLCOMMERZ,
    );
    expect(paymentGatewaySchema.parse("CASH_ON_DELIVERY")).toBe(
      PaymentGateway.CASH_ON_DELIVERY,
    );
  });

  it("paymentGatewaySchema rejects invalid payment gateways", () => {
    expect(() => paymentGatewaySchema.parse("APPLE_PAY")).toThrow();
  });

  it("discountTypeSchema validates valid discount types (AC-11)", () => {
    expect(discountTypeSchema.parse("PERCENTAGE")).toBe(
      DiscountType.PERCENTAGE,
    );
    expect(discountTypeSchema.parse("FIXED_AMOUNT")).toBe(
      DiscountType.FIXED_AMOUNT,
    );
  });

  it("discountTypeSchema rejects invalid discount types", () => {
    expect(() => discountTypeSchema.parse("BOGO")).toThrow();
  });

  it("addressTypeSchema validates valid address types (AC-11)", () => {
    expect(addressTypeSchema.parse("SHIPPING")).toBe(AddressType.SHIPPING);
    expect(addressTypeSchema.parse("BILLING")).toBe(AddressType.BILLING);
  });

  it("addressTypeSchema rejects invalid address types", () => {
    expect(() => addressTypeSchema.parse("HOME")).toThrow();
  });

  it("commissionStatusSchema validates valid commission statuses (AC-11)", () => {
    expect(commissionStatusSchema.parse("PENDING_REVIEW")).toBe(
      CommissionStatus.PENDING_REVIEW,
    );
    expect(commissionStatusSchema.parse("QUOTED")).toBe(
      CommissionStatus.QUOTED,
    );
    expect(commissionStatusSchema.parse("ACCEPTED")).toBe(
      CommissionStatus.ACCEPTED,
    );
    expect(commissionStatusSchema.parse("IN_PRODUCTION")).toBe(
      CommissionStatus.IN_PRODUCTION,
    );
    expect(commissionStatusSchema.parse("COMPLETED")).toBe(
      CommissionStatus.COMPLETED,
    );
    expect(commissionStatusSchema.parse("CANCELLED")).toBe(
      CommissionStatus.CANCELLED,
    );
  });

  it("commissionStatusSchema rejects invalid commission statuses", () => {
    expect(() => commissionStatusSchema.parse("UNKNOWN_STATE")).toThrow();
  });
});
