import { describe, expect, it } from "vitest";
import { resolvePostSignInPath, sanitizeNextPath } from "./next-path.js";

/**
 * Tests for the shared post sign in path rule.
 *
 * The same function guards the API OAuth state and the web navigation, so the
 * cases below cover both open redirects and the auth screens that must never
 * become a destination.
 */
describe("sanitizeNextPath", () => {
  it("keeps a relative path, including its query and hash", () => {
    expect(sanitizeNextPath("/orders?page=2#latest")).toBe(
      "/orders?page=2#latest",
    );
  });

  it("falls back when the value is missing", () => {
    expect(sanitizeNextPath(null, "/admin")).toBe("/admin");
    expect(sanitizeNextPath("", "/admin")).toBe("/admin");
  });

  it.each([
    ["an absolute URL", "https://evil.example/orders"],
    ["a protocol relative URL", "//evil.example/orders"],
    ["a backslash", "/\\evil.example"],
    ["a space", "/orders page"],
    ["a control character", "/orders\u0000"],
  ])("rejects %s", (_label, value) => {
    expect(sanitizeNextPath(value)).toBe("/");
  });

  it.each([
    "/login",
    "/login/",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/callback/",
    "/auth/callback?provider=google&status=success",
    "/login?next=%2Fadmin",
  ])("rejects the auth screen %s", (value) => {
    expect(sanitizeNextPath(value, "/admin")).toBe("/admin");
  });

  it("does not reject a normal path that starts with an auth name", () => {
    expect(sanitizeNextPath("/login-help")).toBe("/login-help");
  });
});

describe("resolvePostSignInPath", () => {
  it("uses the role default when next is missing", () => {
    expect(resolvePostSignInPath(null, "ADMIN")).toBe("/admin");
    expect(resolvePostSignInPath(null, "CUSTOMER")).toBe("/");
  });

  it("uses the role default when next points at an auth screen", () => {
    expect(resolvePostSignInPath("/auth/callback", "ADMIN")).toBe("/admin");
    expect(resolvePostSignInPath("/login", "CUSTOMER")).toBe("/");
  });

  it("keeps a valid relative next for either role", () => {
    expect(resolvePostSignInPath("/orders", "ADMIN")).toBe("/orders");
    expect(resolvePostSignInPath("/orders", "CUSTOMER")).toBe("/orders");
  });

  it("does not send a customer into the admin area", () => {
    expect(resolvePostSignInPath("/admin", "CUSTOMER")).toBe("/");
    expect(resolvePostSignInPath("/admin/products?page=2", "CUSTOMER")).toBe(
      "/",
    );
    expect(resolvePostSignInPath("/administrator", "CUSTOMER")).toBe(
      "/administrator",
    );
  });

  it("keeps an admin path for an admin", () => {
    expect(resolvePostSignInPath("/admin/products", "ADMIN")).toBe(
      "/admin/products",
    );
  });
});
