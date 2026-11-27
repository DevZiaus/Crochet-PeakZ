import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import {
  InMemoryCatalogRepository,
  identityImageUrls,
  makeImage,
  makeProduct,
  makeVariant,
} from "../../test-support/catalog-fakes.js";
import { createCartRouter } from "./cart.routes.js";

const PROXY_SECRET = "test-cart-proxy-secret-0123456789";
const WEB_APP_URL = "http://web.test";

const PROD_STANDARD = "0194f3e0-1000-7abc-8def-012345678901";
const PROD_INACTIVE = "0194f3e0-1000-7abc-8def-012345678902";
const PROD_MISSING = "0194f3e0-1000-7abc-8def-012345678999";
const VAR_IN_STOCK = "0194f3e0-2000-7abc-8def-012345678901";
const VAR_LOW_STOCK = "0194f3e0-2000-7abc-8def-012345678902";
const VAR_ZERO_STOCK = "0194f3e0-2000-7abc-8def-012345678903";
const VAR_INACTIVE = "0194f3e0-2000-7abc-8def-012345678904";

const testEnv: ApiEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgresql://unused",
  corsOrigins: [WEB_APP_URL],
  trustProxy: 1,
  jwtSecret: "test-jwt-secret",
  jwtRefreshSecret: "test-refresh-secret",
  proxySharedSecret: PROXY_SECRET,
  webAppUrl: WEB_APP_URL,
  resendApiKey: "",
  emailFrom: "test@example.com",
  contactEmail: "contact@example.com",
  contactEmailTransport: "log",
  cloudinaryCloudName: "demo",
  googleClient: { id: "google-test-id", secret: "google-test-secret" },
  facebookClient: { id: "facebook-test-id", secret: "facebook-test-secret" },
};

let server: Server;
let baseUrl: string;
let repository: InMemoryCatalogRepository;

beforeAll(async () => {
  repository = new InMemoryCatalogRepository();
  repository.products = [
    makeProduct({
      id: PROD_STANDARD,
      slug: "sunflower-bear",
      title: "Sunflower Bear",
      productType: "STANDARD",
      priceBdt: 1800,
      priceUsd: 22,
      images: [
        makeImage({
          id: "img-1",
          imageUrl: "products/bear",
          altText: "Bear photo",
          isPrimary: true,
        }),
      ],
      variants: [
        makeVariant({
          id: VAR_IN_STOCK,
          colorName: "Honey Gold",
          stockQuantity: 6,
          additionalPriceBdt: 100,
          additionalPriceUsd: 1,
        }),
        makeVariant({
          id: VAR_LOW_STOCK,
          colorName: "Sage",
          stockQuantity: 2,
        }),
        makeVariant({
          id: VAR_ZERO_STOCK,
          colorName: "Blush",
          stockQuantity: 0,
        }),
      ],
    }),
    makeProduct({
      id: PROD_INACTIVE,
      slug: "retired-scarf",
      title: "Retired Scarf",
      isActive: false,
      variants: [makeVariant({ id: VAR_INACTIVE, stockQuantity: 5 })],
    }),
  ];

  const cartRouter = createCartRouter({
    quote: {
      catalog: repository,
      imageUrls: identityImageUrls,
      clock: { now: () => new Date("2026-11-27T12:00:00.000Z") },
    },
    proxySharedSecret: PROXY_SECRET,
    webAppUrl: WEB_APP_URL,
    trustedProxyHops: 1,
  });

  const app = createApp(
    testEnv,
    () => Promise.resolve(true),
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
});

describe("POST /api/cart/quote", () => {
  it("resolves live stock, lowering, out of stock, inactive, and missing lines", async () => {
    const res = await fetch(`${baseUrl}/api/cart/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-proxy-secret": PROXY_SECRET,
        "x-proxy-client-ip": "198.51.100.1",
        origin: WEB_APP_URL,
      },
      body: JSON.stringify({
        lines: [
          {
            productId: PROD_STANDARD,
            variantId: VAR_LOW_STOCK,
            quantity: 5,
            addedAt: "2026-11-27T10:00:00.000Z",
          },
          {
            productId: PROD_STANDARD,
            variantId: VAR_IN_STOCK,
            quantity: 2,
            addedAt: "2026-11-27T11:00:00.000Z",
          },
          {
            productId: PROD_STANDARD,
            variantId: VAR_ZERO_STOCK,
            quantity: 1,
            addedAt: "2026-11-27T09:00:00.000Z",
          },
          {
            productId: PROD_INACTIVE,
            variantId: VAR_INACTIVE,
            quantity: 1,
            addedAt: "2026-11-27T08:00:00.000Z",
          },
          {
            productId: PROD_MISSING,
            variantId: "0194f3e0-2000-7abc-8def-012345678999",
            quantity: 1,
            addedAt: "2026-11-27T07:00:00.000Z",
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        lines: Array<{
          variantId: string;
          status: string;
          quantity: number;
          maxQuantity: number;
          unitPriceBdt: number | null;
          title: string | null;
        }>;
      };
    };

    expect(body.data.lines.map((line) => line.variantId)).toEqual([
      VAR_IN_STOCK,
      VAR_LOW_STOCK,
      VAR_ZERO_STOCK,
      VAR_INACTIVE,
      "0194f3e0-2000-7abc-8def-012345678999",
    ]);

    expect(body.data.lines[0]).toMatchObject({
      status: "OK",
      quantity: 2,
      maxQuantity: 6,
      unitPriceBdt: 1900,
    });
    expect(body.data.lines[1]).toMatchObject({
      status: "LOWERED",
      quantity: 2,
      maxQuantity: 2,
    });
    expect(body.data.lines[2]).toMatchObject({
      status: "OUT_OF_STOCK",
      maxQuantity: 0,
    });
    expect(body.data.lines[3]).toMatchObject({
      status: "UNAVAILABLE",
      title: "Retired Scarf",
      maxQuantity: 0,
    });
    expect(body.data.lines[4]).toMatchObject({
      status: "UNAVAILABLE",
      title: null,
      unitPriceBdt: null,
    });
  });

  it("rejects invalid payloads with 400 INVALID_CART", async () => {
    const res = await fetch(`${baseUrl}/api/cart/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-proxy-secret": PROXY_SECRET,
        "x-proxy-client-ip": "198.51.100.2",
        origin: WEB_APP_URL,
      },
      body: JSON.stringify({
        lines: [
          { productId: "not-a-uuid", variantId: VAR_IN_STOCK, quantity: 1 },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CART");
  });

  it("enforces proxy secret (401) and origin (403)", async () => {
    const noSecret = await fetch(`${baseUrl}/api/cart/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: WEB_APP_URL,
      },
      body: JSON.stringify({ lines: [] }),
    });
    expect(noSecret.status).toBe(401);

    const badOrigin = await fetch(`${baseUrl}/api/cart/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-proxy-secret": PROXY_SECRET,
        origin: "https://evil.example",
      },
      body: JSON.stringify({ lines: [] }),
    });
    expect(badOrigin.status).toBe(403);
  });

  it("rate limits the 61st quote from one IP with 429 and Retry-After", async () => {
    const ip = "198.51.100.61";
    for (let i = 0; i < 60; i += 1) {
      const ok = await fetch(`${baseUrl}/api/cart/quote`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-proxy-secret": PROXY_SECRET,
          "x-proxy-client-ip": ip,
          origin: WEB_APP_URL,
        },
        body: JSON.stringify({ lines: [] }),
      });
      expect(ok.status).toBe(200);
    }

    const limited = await fetch(`${baseUrl}/api/cart/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-proxy-secret": PROXY_SECRET,
        "x-proxy-client-ip": ip,
        origin: WEB_APP_URL,
      },
      body: JSON.stringify({ lines: [] }),
    });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
