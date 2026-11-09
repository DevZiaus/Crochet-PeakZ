import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProductDetailDto } from "@crochet-peakz/shared";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CatalogErrorState } from "@/components/catalog/catalog-error-state";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { PurchasePanel } from "@/components/catalog/purchase-panel";
import { Container } from "@/components/container";
import { ProductGrid } from "@/components/product-grid";
import { fetchCatalogProduct, isCatalogNotFound } from "@/lib/catalog/api";
import { getActiveCurrency } from "@/lib/catalog/currency";
import { getCatalogEnv } from "@/lib/catalog/env";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/catalog/json-ld";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const defaultDescription =
  "Handmade crochet pieces, from amigurumi friends to cosy scarves.";

async function loadProduct(slug: string): Promise<ProductDetailDto | null> {
  try {
    return await fetchCatalogProduct(slug);
  } catch (error) {
    if (isCatalogNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Builds the product metadata from the stored SEO fields, with the product
 * title and description as fallbacks.
 *
 * @param props Route props carrying the product slug.
 * @returns Page metadata with canonical and OpenGraph image.
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { webAppUrl } = getCatalogEnv();
  const canonical = `${webAppUrl}/shop/${slug}`;

  try {
    const product = await fetchCatalogProduct(slug);
    const title = product.metaTitle ?? product.title;
    const description =
      product.metaDescription ?? product.description.trim().slice(0, 160);
    const image = product.primaryImageUrl ?? "/images/og-default.webp";

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: "website",
        images: [{ url: image, alt: product.primaryImageAlt ?? product.title }],
      },
    };
  } catch (error) {
    if (isCatalogNotFound(error)) {
      return {
        title: "This piece could not be found",
        description: defaultDescription,
        robots: { index: false },
      };
    }
    return { title: "Shop handmade crochet" };
  }
}

/**
 * Product detail page: breadcrumbs, gallery, purchase panel with variants,
 * details, related products, and Product JSON-LD.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const currency = await getActiveCurrency();
  const { webAppUrl } = getCatalogEnv();

  let product: ProductDetailDto | null;
  try {
    product = await loadProduct(slug);
  } catch {
    return (
      <Container className="py-16">
        <CatalogErrorState
          heading="We could not load this piece"
          description="Something went wrong on our side. Please try again."
        />
      </Container>
    );
  }

  if (product === null) {
    notFound();
  }

  const productUrl = `${webAppUrl}/shop/${product.slug}`;
  const fallbackImage = new URL(
    "/images/og-default.webp",
    webAppUrl,
  ).toString();
  const jsonLd = buildProductJsonLd(
    product,
    currency,
    productUrl,
    fallbackImage,
  );

  const breadcrumbItems = [
    { label: "Shop", href: "/shop" },
    ...product.categoryTrail.map((category) => ({
      label: category.name,
      href: `/collections/${category.slug}`,
    })),
    { label: product.title },
  ];

  return (
    <Container className="py-8 sm:py-12">
      <Breadcrumbs items={breadcrumbItems} className="mb-6" />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} productTitle={product.title} />

        <div>
          <div className="mb-6">
            {product.category !== null ? (
              <Link
                href={`/collections/${product.category.slug}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary transition-colors duration-200 hover:text-primary-hover motion-reduce:transition-none"
              >
                {product.category.name}
              </Link>
            ) : null}
            <h1 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              {product.title}
            </h1>
          </div>

          <PurchasePanel product={product} currency={currency} />
        </div>
      </div>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Details
        </h2>
        <p className="mt-4 max-w-2xl whitespace-pre-line text-muted-foreground">
          {product.description}
        </p>
        {product.tags.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
            {product.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {product.related.length > 0 ? (
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 font-heading text-2xl font-bold text-foreground">
            You may also like
          </h2>
          <ProductGrid products={product.related} activeCurrency={currency} />
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </Container>
  );
}
