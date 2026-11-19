import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import {
  identityImageUrls,
  InMemoryCatalogRepository,
  makeCategory,
  makeImage,
  makeProduct,
  makeVariant,
} from "../../test-support/catalog-fakes.js";
import { createCatalogRouter } from "./catalog.routes.js";

const env: ApiEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgresql://user:pass@localhost:5432/db",
  corsOrigins: ["https://shop.example.com"],
  trustProxy: false,
  webAppUrl: "https://shop.example.com",
  proxySharedSecret: "proxy-secret-0123456789",
  jwtSecret: "a".repeat(32),
  jwtRefreshSecret: "b".repeat(32),
  googleClient: { id: "google-id", secret: "google-secret" },
  facebookClient: { id: "facebook-id", secret: "facebook-secret" },
  resendApiKey: "re_test_key",
  emailFrom: "Crochet PeakZ <hello@example.com>",
  cloudinaryCloudName: "crochet-peakz",
};

/**
 * Builds the repository used by the router suite.
 *
 * @returns Seeded in memory repository.
 */
function createRepository(): InMemoryCatalogRepository {
  const repository = new InMemoryCatalogRepository();
  repository.categories = [
    makeCategory({ id: "root", slug: "wearables", name: "Wearables" }),
    makeCategory({
      id: "scarves",
      slug: "scarves",
      name: "Scarves",
      parentId: "root",
    }),
  ];
  repository.products = [
    makeProduct({
      id: "bear",
      slug: "bear",
      categoryId: "root",
      category: { id: "root", name: "Wearables", slug: "wearables" },
      priceBdt: 1800,
      priceUsd: 22,
      isFeatured: true,
      images: [makeImage({ id: "bear-image", isPrimary: true })],
      variants: [makeVariant({ id: "bear-v1", stockQuantity: 4 })],
    }),
    makeProduct({
      id: "scarf",
      slug: "scarf",
      categoryId: "scarves",
      category: { id: "scarves", name: "Scarves", slug: "scarves" },
      priceBdt: 2400,
      priceUsd: 29,
      variants: [makeVariant({ id: "scarf-v1", stockQuantity: 2 })],
    }),
    makeProduct({
      id: "hidden",
      slug: "hidden",
      isActive: false,
      variants: [makeVariant({ id: "hidden-v1", stockQuantity: 1 })],
    }),
  ];
  return repository;
}

describe("catalog router", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const repository = createRepository();
    const app = createApp(
      env,
      () => Promise.resolve(true),
      undefined,
      createCatalogRouter({
        catalog: repository,
        imageUrls: identityImageUrls,
      }),
    );
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, "close");
  });

  it("returns the public list envelope without auth", async () => {
    const response = await fetch(`${baseUrl}/api/products`);
    const body = (await response.json()) as {
      data: { slug: string }[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 12,
      total: 2,
      totalPages: 1,
    });
    expect(body.data.map((product) => product.slug)).toEqual(["bear", "scarf"]);
    expect(body.data[0]).not.toHaveProperty("isActive");
    expect(body.data[0]).not.toHaveProperty("deletedAt");
  });

  it("accepts repeated filters and price ranges", async () => {
    const response = await fetch(
      `${baseUrl}/api/products?category=wearables&type=STANDARD&minPrice=2000&currency=BDT`,
    );
    const body = (await response.json()) as { data: { slug: string }[] };

    expect(response.status).toBe(200);
    expect(body.data.map((product) => product.slug)).toEqual(["scarf"]);
  });

  it("rejects malformed query values with 400 INVALID_QUERY", async () => {
    const response = await fetch(`${baseUrl}/api/products?type=SHIRT&page=0`);
    const body = (await response.json()) as {
      error: { code: string; details: { issues: unknown[] } };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_QUERY");
    expect(body.error.details.issues.length).toBeGreaterThan(0);
  });

  it("rejects a minimum price above the maximum", async () => {
    const response = await fetch(
      `${baseUrl}/api/products?minPrice=50&maxPrice=10`,
    );

    expect(response.status).toBe(400);
  });

  it("returns a product detail with resolved images", async () => {
    const response = await fetch(`${baseUrl}/api/products/bear`);
    const body = (await response.json()) as {
      data: { slug: string; images: { url: string }[]; variants: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.slug).toBe("bear");
    expect(body.data.images[0]?.url).toBe("image-bear-image");
    expect(body.data.variants).toHaveLength(1);
  });

  it("returns 404 PRODUCT_NOT_FOUND for hidden and unknown slugs", async () => {
    for (const slug of ["hidden", "missing"]) {
      const response = await fetch(`${baseUrl}/api/products/${slug}`);
      const body = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(404);
      expect(body.error.code).toBe("PRODUCT_NOT_FOUND");
    }
  });

  it("returns categories and category detail", async () => {
    const listResponse = await fetch(`${baseUrl}/api/categories`);
    const listBody = (await listResponse.json()) as {
      data: { slug: string; productCount: number }[];
    };

    expect(listResponse.status).toBe(200);
    expect(
      listBody.data.find((item) => item.slug === "wearables"),
    ).toMatchObject({ productCount: 2 });

    const detailResponse = await fetch(`${baseUrl}/api/categories/wearables`);
    const detailBody = (await detailResponse.json()) as {
      data: { slug: string; children: { slug: string }[] };
    };

    expect(detailResponse.status).toBe(200);
    expect(detailBody.data.children.map((child) => child.slug)).toEqual([
      "scarves",
    ]);
  });

  it("returns 404 CATEGORY_NOT_FOUND for unknown categories", async () => {
    const response = await fetch(`${baseUrl}/api/categories/missing`);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("CATEGORY_NOT_FOUND");
  });
});
