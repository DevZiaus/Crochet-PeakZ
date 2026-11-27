import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import { JwtTokenService } from "../../infrastructure/auth/jwt-token-service.js";
import { PrismaCartRepository } from "../../infrastructure/database/cart.repository.js";
import { PrismaCatalogRepository } from "../../infrastructure/database/catalog.repository.js";
import {
  createDatabase,
  type Database,
} from "../../infrastructure/database/prisma.js";
import { identityImageUrls } from "../../test-support/catalog-fakes.js";
import { createCartRouter } from "./cart.routes.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

const PROXY_SECRET = "integration-cart-proxy-secret-0123456789";
const WEB_APP_URL = "http://web.integration.test";
const JWT_SECRET = "integration-cart-jwt-secret-0123456789abcdef";
const REFRESH_SECRET = "integration-cart-refresh-secret-0123456789abcd";

describeWithDatabase("Account cart API + PostgreSQL integration", () => {
  let database: Database;
  let server: Server;
  let baseUrl: string;
  let tokens: JwtTokenService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  let currentNow = new Date("2026-11-27T12:00:00.000Z");

  function authHeaders(
    accessToken: string,
    ip = "198.51.100.10",
  ): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-proxy-secret": PROXY_SECRET,
      "x-proxy-client-ip": ip,
      origin: WEB_APP_URL,
      cookie: `cp_access=${accessToken}`,
    };
  }

  async function createTestUser(
    role: "CUSTOMER" | "ADMIN" = "CUSTOMER",
  ): Promise<{ user: { id: string; role: string }; accessToken: string }> {
    const email = `cart-it-${randomUUID().slice(0, 10)}@example.com`;
    const user = await database.client.user.create({
      data: {
        name: role === "ADMIN" ? "Cart Admin" : "Cart Shopper",
        email,
        role,
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);
    const accessToken = await tokens.signAccessToken({
      sub: user.id,
      role: user.role,
    });
    return { user, accessToken };
  }

  async function createTestProduct(input: {
    title: string;
    productType?:
      "STANDARD" | "ONE_OF_A_KIND" | "DIGITAL" | "PRE_ORDER" | "CUSTOM";
    isActive?: boolean;
    deletedAt?: Date | null;
    variants: Array<{ colorName?: string; stockQuantity: number }>;
  }): Promise<{
    id: string;
    variants: Array<{ id: string; colorName: string | null }>;
  }> {
    const slug = `cart-it-${randomUUID().slice(0, 10)}`;
    const product = await database.client.product.create({
      data: {
        title: input.title,
        slug,
        description: "Integration test crochet piece.",
        productType: input.productType ?? "STANDARD",
        priceBdt: 1500,
        priceUsd: 18,
        isActive: input.isActive ?? true,
        deletedAt: input.deletedAt ?? null,
        images: {
          create: {
            imageUrl: `products/${slug}`,
            altText: input.title,
            isPrimary: true,
            displayOrder: 0,
          },
        },
        variants: {
          create: input.variants.map((variant) => ({
            colorName: variant.colorName ?? "Natural",
            stockQuantity: variant.stockQuantity,
          })),
        },
      },
      include: { variants: true },
    });
    createdProductIds.push(product.id);
    return product;
  }

  beforeAll(async () => {
    database = createDatabase(databaseUrl as string);
    await database.client.$connect();

    tokens = new JwtTokenService({
      jwtSecret: JWT_SECRET,
      refreshSecret: REFRESH_SECRET,
    });

    const env: ApiEnv = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 0,
      databaseUrl: databaseUrl as string,
      corsOrigins: [WEB_APP_URL],
      trustProxy: 1,
      jwtSecret: JWT_SECRET,
      jwtRefreshSecret: REFRESH_SECRET,
      proxySharedSecret: PROXY_SECRET,
      webAppUrl: WEB_APP_URL,
      resendApiKey: "",
      emailFrom: "test@example.com",
      contactEmail: "contact@example.com",
      contactEmailTransport: "log",
      cloudinaryCloudName: "demo",
      googleClient: { id: "g-id", secret: "g-secret" },
      facebookClient: { id: "f-id", secret: "f-secret" },
    };

    const clock = { now: () => currentNow };
    const cartRouter = createCartRouter({
      quote: {
        catalog: new PrismaCatalogRepository(database.client),
        imageUrls: identityImageUrls,
        clock,
      },
      account: {
        carts: new PrismaCartRepository(database.client),
        imageUrls: identityImageUrls,
        clock,
      },
      tokens,
      proxySharedSecret: PROXY_SECRET,
      webAppUrl: WEB_APP_URL,
      trustedProxyHops: 1,
    });

    const app = createApp(
      env,
      database.checkHealth,
      undefined,
      undefined,
      undefined,
      cartRouter,
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    if (createdUserIds.length > 0) {
      await database.client.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (createdProductIds.length > 0) {
      await database.client.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }
    await database.disconnect();
  });

  it("enforces the SQL CHECK (quantity BETWEEN 1 AND 10) constraint on cart_items", async () => {
    const { user } = await createTestUser();
    const product = await createTestProduct({
      title: "Constraint Piece",
      variants: [{ stockQuantity: 5 }],
    });
    const variant = product.variants[0];
    if (!variant) throw new Error("variant missing");

    const cart = await database.client.cart.create({
      data: { userId: user.id },
    });

    await expect(
      database.client.$executeRaw`
        INSERT INTO "cart_items" ("id", "cart_id", "product_id", "variant_id", "quantity", "created_at", "updated_at")
        VALUES (${randomUUID()}, ${cart.id}, ${product.id}, ${variant.id}, 0, NOW(), NOW())
      `,
    ).rejects.toThrow();

    await expect(
      database.client.$executeRaw`
        INSERT INTO "cart_items" ("id", "cart_id", "product_id", "variant_id", "quantity", "created_at", "updated_at")
        VALUES (${randomUUID()}, ${cart.id}, ${product.id}, ${variant.id}, 11, NOW(), NOW())
      `,
    ).rejects.toThrow();
  });

  it("requires session and proxy secret, enforces origin, and allows ADMIN accounts (AC-16)", async () => {
    const noSecret = await fetch(`${baseUrl}/api/cart`);
    expect(noSecret.status).toBe(401);

    const noSession = await fetch(`${baseUrl}/api/cart`, {
      headers: { "x-proxy-secret": PROXY_SECRET },
    });
    expect(noSession.status).toBe(401);

    const { accessToken: adminToken } = await createTestUser("ADMIN");
    const adminRes = await fetch(`${baseUrl}/api/cart`, {
      headers: {
        "x-proxy-secret": PROXY_SECRET,
        cookie: `cp_access=${adminToken}`,
      },
    });
    expect(adminRes.status).toBe(200);
    expect(await adminRes.json()).toEqual({
      data: { lines: [], adjustments: [] },
    });

    const badOrigin = await fetch(`${baseUrl}/api/cart`, {
      method: "DELETE",
      headers: {
        "x-proxy-secret": PROXY_SECRET,
        origin: "https://attacker.example",
        cookie: `cp_access=${adminToken}`,
      },
    });
    expect(badOrigin.status).toBe(403);
  });

  it("handles parallel first time POST /api/cart/items on a new user with stock 1 without P2002", async () => {
    const { user, accessToken } = await createTestUser();
    const product = await createTestProduct({
      title: "Last Bear",
      variants: [{ colorName: "Cream", stockQuantity: 1 }],
    });
    const variant = product.variants[0];
    if (!variant) throw new Error("variant missing");

    const sendAdd = (): Promise<Response> =>
      fetch(`${baseUrl}/api/cart/items`, {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({ productId: product.id, variantId: variant.id }),
      });

    const [resA, resB] = await Promise.all([sendAdd(), sendAdd()]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const bodyA = (await resA.json()) as { outcome: string };
    const bodyB = (await resB.json()) as { outcome: string };
    expect([bodyA.outcome, bodyB.outcome].sort()).toEqual([
      "ADDED",
      "AT_LIMIT",
    ]);

    const items = await database.client.cartItem.findMany({
      where: { cart: { userId: user.id } },
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(1);
  });

  it("supports full CRUD, stock lowering without bumping Cart.updatedAt, 404/409/clamp on PATCH, and user isolation", async () => {
    currentNow = new Date("2026-11-27T12:00:00.000Z");
    const { user: userA, accessToken: tokenA } = await createTestUser();
    const { accessToken: tokenB } = await createTestUser();

    const product = await createTestProduct({
      title: "Botanical Tote",
      variants: [
        { colorName: "Sage", stockQuantity: 5 },
        { colorName: "Rose", stockQuantity: 2 },
      ],
    });
    const sage = product.variants.find((v) => v.colorName === "Sage");
    const rose = product.variants.find((v) => v.colorName === "Rose");
    if (!sage || !rose) throw new Error("variants missing");

    // Add Sage twice, then add Rose later so Rose sorts newest first.
    const add1 = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: authHeaders(tokenA),
      body: JSON.stringify({ productId: product.id, variantId: sage.id }),
    });
    expect(add1.status).toBe(200);

    currentNow = new Date("2026-11-27T12:01:00.000Z");
    const add2 = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: authHeaders(tokenA),
      body: JSON.stringify({ productId: product.id, variantId: rose.id }),
    });
    expect(add2.status).toBe(200);

    // Patch Sage up to 4 (must NOT change order; Rose stays newest first).
    currentNow = new Date("2026-11-27T12:02:00.000Z");
    const patchSage = await fetch(`${baseUrl}/api/cart/items/${sage.id}`, {
      method: "PATCH",
      headers: authHeaders(tokenA),
      body: JSON.stringify({ quantity: 4 }),
    });
    expect(patchSage.status).toBe(200);
    const patchSageBody = (await patchSage.json()) as {
      data: { lines: Array<{ variantId: string; quantity: number }> };
    };
    expect(patchSageBody.data.lines.map((l) => l.variantId)).toEqual([
      rose.id,
      sage.id,
    ]);

    // User B sees empty cart (cross-user isolation).
    const userBCart = await fetch(`${baseUrl}/api/cart`, {
      headers: authHeaders(tokenB),
    });
    expect(await userBCart.json()).toEqual({
      data: { lines: [], adjustments: [] },
    });

    // Record Cart.updatedAt before stock drops from 5 to 2.
    const cartBeforeLower = await database.client.cart.findUniqueOrThrow({
      where: { userId: userA.id },
    });

    await database.client.productVariant.update({
      where: { id: sage.id },
      data: { stockQuantity: 2 },
    });

    // Passive GET /api/cart lowers quantity to 2 WITHOUT advancing Cart.updatedAt.
    currentNow = new Date("2026-11-27T15:00:00.000Z");
    const getLowered = await fetch(`${baseUrl}/api/cart`, {
      headers: authHeaders(tokenA),
    });
    expect(getLowered.status).toBe(200);
    const loweredBody = (await getLowered.json()) as {
      data: {
        lines: Array<{ variantId: string; status: string; quantity: number }>;
      };
    };
    const loweredSage = loweredBody.data.lines.find(
      (l) => l.variantId === sage.id,
    );
    expect(loweredSage).toMatchObject({ status: "LOWERED", quantity: 2 });

    const cartAfterLower = await database.client.cart.findUniqueOrThrow({
      where: { userId: userA.id },
    });
    expect(cartAfterLower.updatedAt.getTime()).toBe(
      cartBeforeLower.updatedAt.getTime(),
    );

    // PATCH requesting above stock clamps and returns LOWERED adjustment.
    const clampPatch = await fetch(`${baseUrl}/api/cart/items/${sage.id}`, {
      method: "PATCH",
      headers: authHeaders(tokenA),
      body: JSON.stringify({ quantity: 5 }),
    });
    expect(clampPatch.status).toBe(200);
    const clampBody = (await clampPatch.json()) as {
      data: {
        adjustments: Array<{
          variantId: string;
          kind: string;
          quantity: number;
        }>;
      };
    };
    expect(clampBody.data.adjustments).toEqual([
      {
        variantId: sage.id,
        title: "Botanical Tote",
        kind: "LOWERED",
        quantity: 2,
      },
    ]);

    // Drop Rose stock to 0 => PATCH returns 409 ITEM_UNAVAILABLE with fresh data and unchanged DB qty.
    await database.client.productVariant.update({
      where: { id: rose.id },
      data: { stockQuantity: 0 },
    });
    const unavailablePatch = await fetch(
      `${baseUrl}/api/cart/items/${rose.id}`,
      {
        method: "PATCH",
        headers: authHeaders(tokenA),
        body: JSON.stringify({ quantity: 2 }),
      },
    );
    expect(unavailablePatch.status).toBe(409);
    const unavailableBody = (await unavailablePatch.json()) as {
      error: { code: string };
      data: { lines: Array<{ variantId: string; status: string }> };
    };
    expect(unavailableBody.error.code).toBe("ITEM_UNAVAILABLE");
    expect(
      unavailableBody.data.lines.find((l) => l.variantId === rose.id)?.status,
    ).toBe("OUT_OF_STOCK");

    // PATCH on a variant not in cart => 404 NOT_IN_CART.
    const missingPatch = await fetch(
      `${baseUrl}/api/cart/items/${randomUUID()}`,
      {
        method: "PATCH",
        headers: authHeaders(tokenA),
        body: JSON.stringify({ quantity: 1 }),
      },
    );
    expect(missingPatch.status).toBe(404);
    expect(
      ((await missingPatch.json()) as { error: { code: string } }).error.code,
    ).toBe("NOT_IN_CART");

    // DELETE item (present, then already absent => both 200) and DELETE cart.
    const delPresent = await fetch(`${baseUrl}/api/cart/items/${rose.id}`, {
      method: "DELETE",
      headers: authHeaders(tokenA),
    });
    expect(delPresent.status).toBe(200);
    const delAbsent = await fetch(`${baseUrl}/api/cart/items/${rose.id}`, {
      method: "DELETE",
      headers: authHeaders(tokenA),
    });
    expect(delAbsent.status).toBe(200);

    const clearRes = await fetch(`${baseUrl}/api/cart`, {
      method: "DELETE",
      headers: authHeaders(tokenA),
    });
    expect(clearRes.status).toBe(200);
    expect(await clearRes.json()).toEqual({
      data: { lines: [], adjustments: [] },
    });
  });

  it("lazily expires an idle account cart after 30 days on read", async () => {
    currentNow = new Date("2026-11-27T12:00:00.000Z");
    const { user, accessToken } = await createTestUser();
    const product = await createTestProduct({
      title: "Aging Shawl",
      variants: [{ stockQuantity: 5 }],
    });
    const variant = product.variants[0];
    if (!variant) throw new Error("variant missing");

    await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({ productId: product.id, variantId: variant.id }),
    });

    // Advance clock 31 days without any write.
    currentNow = new Date("2026-12-28T12:00:00.000Z");
    const res = await fetch(`${baseUrl}/api/cart`, {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { lines: [], adjustments: [] },
    });

    const remaining = await database.client.cartItem.count({
      where: { cart: { userId: user.id } },
    });
    expect(remaining).toBe(0);
    currentNow = new Date("2026-11-27T12:00:00.000Z");
  });
});
