/**
 * Prisma seed script for Crochet PeakZ.
 *
 * Loads realistic test data: 2 users (1 admin, 1 customer), 3 categories
 * (1 nested), 5 products with variants and images, 1 coupon, 1 shipping
 * zone, and 3 store settings entries.
 *
 * Satisfies AC-9 and AC-10 from spec 0002.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import {
  DiscountType,
  PrismaClient,
  ProductType,
  UserRole,
} from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required to seed the database. " +
      "Copy apps/api/.env.example to apps/api/.env first.",
  );
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 300_000,
});

const prisma = new PrismaClient({ adapter });

/**
 * Hash a dev seed password with bcrypt. Uses the same format the auth
 * feature will verify against, so seeded users can sign in later.
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Derive a URL safe slug from a product title.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A variant row attached to a seeded product. */
interface SeedVariant {
  sku: string;
  colorName: string;
  colorHex: string;
  yarnType?: string;
  stockQuantity: number;
}

/** An image row attached to a seeded product. */
interface SeedImage {
  imageUrl: string;
  altText?: string;
  isPrimary?: boolean;
}

/** The deliverable file row of a seeded digital product. */
interface SeedDigitalAsset {
  fileName: string;
  fileKey: string;
  fileSizeBytes: bigint;
  fileType: string;
}

/** One seeded product and its child rows. */
interface SeedProduct {
  title: string;
  description: string;
  productType: ProductType;
  priceBdt: number;
  priceUsd: number;
  categoryId: string | null;
  isFeatured?: boolean;
  leadTimeDays?: number;
  tags: string[];
  variants: SeedVariant[];
  images: SeedImage[];
  digitalAsset?: SeedDigitalAsset;
}

async function main(): Promise<void> {
  console.log("Seeding Crochet PeakZ database...\n");

  // Users

  const admin = await prisma.user.upsert({
    where: { email: "admin@crochetpeakz.com" },
    update: {},
    create: {
      name: "PeakZ Admin",
      email: "admin@crochetpeakz.com",
      passwordHash: await hashPassword("admin-dev-password"),
      role: UserRole.ADMIN,
      emailVerified: true,
    },
  });
  console.log(`  Admin user: ${admin.email}`);

  const customer = await prisma.user.upsert({
    where: { email: "nadia@example.com" },
    update: {},
    create: {
      name: "Nadia Rahman",
      email: "nadia@example.com",
      passwordHash: await hashPassword("customer-dev-password"),
      role: UserRole.CUSTOMER,
      emailVerified: true,
      phone: "+8801711234567",
    },
  });
  console.log(`  Customer user: ${customer.email}`);

  // Categories

  const amigurumiCategory = await prisma.category.upsert({
    where: { slug: "amigurumi" },
    update: {},
    create: {
      name: "Amigurumi",
      slug: "amigurumi",
      description: "Handcrafted crochet stuffed toys and figurines",
    },
  });

  const wearablesCategory = await prisma.category.upsert({
    where: { slug: "wearables" },
    update: {},
    create: {
      name: "Wearables",
      slug: "wearables",
      description: "Crochet clothing, scarves, hats, and accessories",
    },
  });

  const scarvesCategory = await prisma.category.upsert({
    where: { slug: "scarves" },
    update: {},
    create: {
      name: "Scarves",
      slug: "scarves",
      description: "Hand crocheted scarves in various patterns and yarn types",
      parentId: wearablesCategory.id,
    },
  });

  console.log(
    `  Categories: ${amigurumiCategory.name}, ${wearablesCategory.name}, ` +
      `${scarvesCategory.name} (nested)`,
  );

  // Products

  const productData: SeedProduct[] = [
    {
      title: "Sunflower Amigurumi Bear",
      description:
        "A charming handcrafted amigurumi bear wearing a tiny sunflower crown. Made with premium cotton yarn, this 8 inch plush companion features safety eyes and a hand embroidered smile. Perfect gift for all ages.",
      productType: ProductType.STANDARD,
      priceBdt: 1800.0,
      priceUsd: 22.0,
      categoryId: amigurumiCategory.id,
      isFeatured: true,
      tags: ["amigurumi", "bear", "gift", "cotton"],
      variants: [
        {
          colorName: "Honey Gold",
          colorHex: "#DAA520",
          stockQuantity: 12,
          sku: "SFB-HG-001",
        },
        {
          colorName: "Blush Pink",
          colorHex: "#FFB6C1",
          stockQuantity: 8,
          sku: "SFB-BP-001",
        },
        {
          colorName: "Lavender",
          colorHex: "#E6E6FA",
          stockQuantity: 5,
          sku: "SFB-LV-001",
        },
      ],
      images: [
        {
          imageUrl: "crochet-peakz/products/sunflower-bear-main",
          altText: "Sunflower bear amigurumi front view",
          isPrimary: true,
        },
        {
          imageUrl: "crochet-peakz/products/sunflower-bear-side",
          altText: "Sunflower bear amigurumi side view",
        },
      ],
    },
    {
      title: "Ocean Wave Infinity Scarf",
      description:
        "A luxurious infinity scarf featuring a mesmerizing ocean wave stitch pattern. Crafted from soft merino wool blend yarn, this scarf drapes beautifully and keeps you warm through every season.",
      productType: ProductType.STANDARD,
      priceBdt: 2400.0,
      priceUsd: 29.0,
      categoryId: scarvesCategory.id,
      tags: ["scarf", "merino", "winter", "accessories"],
      variants: [
        {
          colorName: "Deep Teal",
          colorHex: "#008080",
          yarnType: "Merino Blend",
          stockQuantity: 15,
          sku: "OWS-DT-001",
        },
        {
          colorName: "Coral Sunset",
          colorHex: "#FF7F50",
          yarnType: "Merino Blend",
          stockQuantity: 10,
          sku: "OWS-CS-001",
        },
      ],
      images: [
        {
          imageUrl: "crochet-peakz/products/ocean-scarf-main",
          altText: "Ocean wave infinity scarf displayed",
          isPrimary: true,
        },
      ],
    },
    {
      title: "Vintage Lace Doily Collection",
      description:
        "A set of three heirloom quality doilies in graduated sizes (6, 10, and 14 inches). Each piece is crocheted with fine cotton thread using traditional pineapple and fan stitch patterns. One of a kind, never reproduced.",
      productType: ProductType.ONE_OF_A_KIND,
      priceBdt: 4500.0,
      priceUsd: 55.0,
      categoryId: null,
      tags: ["doily", "lace", "vintage", "home-decor", "one-of-a-kind"],
      variants: [
        {
          colorName: "Antique White",
          colorHex: "#FAEBD7",
          stockQuantity: 1,
          sku: "VLD-AW-001",
        },
      ],
      images: [
        {
          imageUrl: "crochet-peakz/products/doily-collection-main",
          altText: "Vintage lace doily collection",
          isPrimary: true,
        },
      ],
    },
    {
      title: "Beginner Crochet Pattern Bundle (Digital)",
      description:
        "A curated collection of 5 beginner friendly crochet patterns in PDF format. Includes a granny square blanket, simple beanie, phone pouch, coaster set, and market bag. Each pattern features step by step photos and a stitch glossary.",
      productType: ProductType.DIGITAL,
      priceBdt: 800.0,
      priceUsd: 9.99,
      categoryId: null,
      tags: ["pattern", "digital", "beginner", "pdf"],
      variants: [],
      images: [
        {
          imageUrl: "crochet-peakz/products/pattern-bundle-main",
          altText: "Beginner crochet pattern bundle cover",
          isPrimary: true,
        },
      ],
      digitalAsset: {
        fileName: "beginner-crochet-patterns-v1.pdf",
        fileKey: "crochet-peakz/digital/beginner-patterns-v1",
        fileSizeBytes: BigInt(4_500_000),
        fileType: "application/pdf",
      },
    },
    {
      title: "Custom Baby Blanket",
      description:
        "Commission a custom baby blanket in your choice of colors, stitch pattern, and size. Each blanket is handcrafted with baby safe, hypoallergenic cotton yarn. Includes a personalized name embroidery option. Allow 3 to 4 weeks for production.",
      productType: ProductType.CUSTOM,
      priceBdt: 5500.0,
      priceUsd: 65.0,
      categoryId: null,
      leadTimeDays: 28,
      tags: ["custom", "baby", "blanket", "commission", "personalized"],
      variants: [],
      images: [
        {
          imageUrl: "crochet-peakz/products/custom-blanket-main",
          altText: "Custom baby blanket example in pastel colors",
          isPrimary: true,
        },
        {
          imageUrl: "crochet-peakz/products/custom-blanket-detail",
          altText: "Custom baby blanket stitch detail",
        },
      ],
    },
  ];

  for (const p of productData) {
    const slug = slugify(p.title);
    const product = await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        title: p.title,
        slug,
        description: p.description,
        productType: p.productType,
        priceBdt: p.priceBdt,
        priceUsd: p.priceUsd,
        categoryId: p.categoryId,
        isFeatured: p.isFeatured ?? false,
        leadTimeDays: p.leadTimeDays ?? 0,
        tags: p.tags,
      },
    });

    // Variants
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          sku: v.sku,
          colorName: v.colorName,
          colorHex: v.colorHex,
          yarnType: v.yarnType ?? null,
          stockQuantity: v.stockQuantity,
        },
      });
    }

    // Images (no unique field, so dedupe on product id plus display order)
    for (const [i, img] of p.images.entries()) {
      const existing = await prisma.productImage.findFirst({
        where: { productId: product.id, displayOrder: i },
      });
      if (!existing) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            imageUrl: img.imageUrl,
            altText: img.altText ?? null,
            isPrimary: img.isPrimary ?? false,
            displayOrder: i,
          },
        });
      }
    }

    // Digital asset (dedupe on product id plus file name)
    if (p.digitalAsset) {
      const da = p.digitalAsset;
      const existingAsset = await prisma.digitalAsset.findFirst({
        where: { productId: product.id, fileName: da.fileName },
      });
      if (!existingAsset) {
        await prisma.digitalAsset.create({
          data: {
            productId: product.id,
            fileName: da.fileName,
            fileKey: da.fileKey,
            fileSizeBytes: da.fileSizeBytes,
            fileType: da.fileType,
          },
        });
      }
    }

    console.log(`  Product: ${product.title} (${p.productType})`);
  }

  // Coupon

  const coupon = await prisma.coupon.upsert({
    where: { code: "WELCOME15" },
    update: {},
    create: {
      code: "WELCOME15",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 15.0,
      minOrderValue: 1000.0,
      maxUses: 100,
      expiresAt: new Date("2027-12-31T23:59:59Z"),
    },
  });
  console.log(
    `  Coupon: ${coupon.code} (${coupon.discountValue.toString()}% off)`,
  );

  // Shipping zone

  const existingZone = await prisma.shippingZone.findFirst({
    where: { name: "Domestic BD" },
  });
  if (!existingZone) {
    await prisma.shippingZone.create({
      data: {
        name: "Domestic BD",
        countries: ["BD"],
        baseRateBdt: 80.0,
        baseRateUsd: 0.0,
        perItemRateBdt: 20.0,
        perItemRateUsd: 0.0,
      },
    });
  }
  console.log("  Shipping zone: Domestic BD");

  // Store settings

  const settings = [
    {
      key: "store_name",
      value: {
        name: "Crochet PeakZ",
        tagline: "Handcrafted with love from the peaks",
      },
      description: "Primary store branding: name and tagline",
    },
    {
      key: "default_currency",
      value: { primary: "BDT", secondary: "USD", displayBoth: true },
      description: "Default currency for pricing display",
    },
    {
      key: "shipping_policy",
      value: {
        freeShippingThresholdBdt: 5000,
        freeShippingThresholdUsd: 60,
        processingDays: 3,
        domesticDeliveryDays: "5-7",
        internationalDeliveryDays: "14-21",
      },
      description: "Shipping thresholds and estimated delivery times",
    },
  ];

  for (const s of settings) {
    await prisma.storeSettings.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        value: s.value,
        description: s.description,
      },
    });
    console.log(`  Store setting: ${s.key}`);
  }

  console.log("\nSeed complete!\n");
}

main()
  .catch((e: unknown) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
