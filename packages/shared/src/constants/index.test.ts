import { describe, it, expect } from "vitest";
import { CURRENCIES, ORDER_STATUSES } from "./index.js";

describe("Constants", () => {
  it("CURRENCIES contains BDT and USD", () => {
    expect(CURRENCIES).toHaveProperty("BDT");
    expect(CURRENCIES).toHaveProperty("USD");
    expect(CURRENCIES.BDT.symbol).toBe("৳");
    expect(CURRENCIES.USD.symbol).toBe("$");
  });

  it("ORDER_STATUSES contains all 9 lifecycle states", () => {
    expect(ORDER_STATUSES).toHaveLength(9);
    expect(ORDER_STATUSES).toContain("PENDING_PAYMENT");
    expect(ORDER_STATUSES).toContain("CONFIRMED");
    expect(ORDER_STATUSES).toContain("PROCESSING");
    expect(ORDER_STATUSES).toContain("HANDCRAFTING");
    expect(ORDER_STATUSES).toContain("READY_TO_SHIP");
    expect(ORDER_STATUSES).toContain("SHIPPED");
    expect(ORDER_STATUSES).toContain("DELIVERED");
    expect(ORDER_STATUSES).toContain("CANCELLED");
    expect(ORDER_STATUSES).toContain("REFUNDED");
  });
});
