import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Hand, HeartHandshake, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollectionCard } from "@/components/collection-card";
import { Container } from "@/components/container";
import { ProductGrid } from "@/components/product-grid";
import { Section } from "@/components/section";
import {
  fetchCatalogCategories,
  fetchCatalogProducts,
} from "@/lib/catalog/api";
import { getActiveCurrency } from "@/lib/catalog/currency";
import { getCatalogEnv } from "@/lib/catalog/env";

/**
 * Home metadata.
 *
 * @returns Page metadata with a canonical URL and the default OpenGraph image.
 */
export function generateMetadata(): Metadata {
  const { webAppUrl } = getCatalogEnv();
  const title = "Crochet PeakZ — Feel The Handmade Love";
  const description =
    "Handmade crochet amigurumi, wearables, patterns, and custom pieces from Crochet PeakZ.";

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: webAppUrl },
    openGraph: {
      title,
      description,
      url: webAppUrl,
      images: [{ url: "/images/og-default.webp", alt: "Crochet PeakZ" }],
    },
  };
}

const promisePillars = [
  {
    icon: Hand,
    title: "Worked by hand",
    body: "Each piece is crocheted in small batches, never mass produced.",
  },
  {
    icon: Leaf,
    title: "Thoughtful materials",
    body: "Soft cottons, warm wool blends, and colours chosen to last.",
  },
  {
    icon: HeartHandshake,
    title: "Made for you",
    body: "Need a different colour or size? Custom orders are always welcome.",
  },
] as const;

/**
 * Storefront home page.
 *
 * Featured products and collections come from the database. A section with no
 * data is hidden rather than rendered empty, so a new catalogue still looks
 * finished on day one.
 */
export default async function HomePage() {
  const activeCurrency = await getActiveCurrency();
  const [featuredResponse, categories] = await Promise.all([
    fetchCatalogProducts({
      featured: true,
      limit: 8,
      currency: activeCurrency,
    }),
    fetchCatalogCategories(),
  ]);

  const featured = featuredResponse.data;
  const collections = categories.filter(
    (category) => category.parentId === null && category.productCount > 0,
  );

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 hidden size-[28rem] rounded-full border border-primary/10 bg-secondary/40 lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-24 hidden size-72 rounded-full border border-dashed border-primary/20 lg:block"
        />
        <Container className="relative py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Handmade in small batches
            </p>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Handmade pieces, made to be kept
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every stitch is worked by hand in our studio, from soft amigurumi
              friends to scarves you will reach for all winter. Small batches,
              thoughtful materials, and a little bit of joy in every piece.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/shop">
                  Shop the collection
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/collections">Explore collections</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {featured.length > 0 && (
        <Container>
          <Section>
            <div className="mb-8 max-w-2xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                Featured pieces
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                A few favourites from the studio, ready to find a home.
              </p>
            </div>
            <ProductGrid products={featured} activeCurrency={activeCurrency} />
            <div className="mt-8">
              <Button asChild variant="link" className="px-0">
                <Link href="/shop">
                  Browse all pieces
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </Section>
        </Container>
      )}

      {collections.length > 0 && (
        <div className="border-y border-border bg-muted/50">
          <Container>
            <Section>
              <div className="mb-8 max-w-2xl">
                <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                  Shop by collection
                </h2>
                <p className="mt-2 text-base text-muted-foreground">
                  Start with a category, then make it yours.
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <CollectionCard category={collection} className="h-full" />
                  </li>
                ))}
              </ul>
            </Section>
          </Container>
        </div>
      )}

      <Container>
        <Section>
          <div className="mb-10 max-w-2xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Made slowly, made well
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {promisePillars.map((pillar) => (
              <li key={pillar.title}>
                <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <pillar.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.body}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </Container>

      <section className="bg-primary text-primary-foreground">
        <Container className="py-14 sm:py-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Have something made just for you?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-primary-foreground/90">
                Tell us what you have in mind and we will work with you on a
                custom piece.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link href="/shop">Start a custom order</Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
