import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CollectionCard } from "@/components/collection-card";
import { Container } from "@/components/container";
import { ProductGrid } from "@/components/product-grid";
import { Section } from "@/components/section";
import {
  fetchCatalogCategories,
  fetchCatalogProducts,
} from "@/lib/catalog/api";
import { getActiveCurrency } from "@/lib/currency/server";
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

const featureCards = [
  {
    number: "01",
    title: "Handmade for real life",
    body: "Pieces designed to be used, loved, and lived with — not tucked away.",
  },
  {
    number: "02",
    title: "Made in small batches",
    body: "Slow craft means fewer things, made better and with a whole lot of intention.",
  },
  {
    number: "03",
    title: "Created to make you smile",
    body: "From tactile treasures to approachable patterns, there is always a little delight.",
  },
] as const;

/**
 * Storefront home page.
 *
 * Combines the Crochet PeakZ brand hero, live featured products and
 * collections from the database, brand story intro, craft pillars, and
 * custom-order call to action. Empty catalog sections are hidden so a fresh
 * catalogue still looks finished.
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
        <Container className="relative py-14 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6">
              <p className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-highlight">
                <span
                  aria-hidden="true"
                  className="h-px w-8 shrink-0 bg-accent"
                />
                Made slowly, made with love
              </p>
              <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Little things with a <em className="italic text-accent">big</em>{" "}
                heart.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Welcome to Crochet PeakZ, a colorful corner for thoughtfully
                handmade crochet pieces, patterns, and the people who love
                making.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/shop">
                    Shop the collection
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/blog">
                    Discover our story
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative mx-auto aspect-square w-full max-w-[460px]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[10%] top-[4%] size-[88%] rounded-full bg-secondary"
                />
                <Image
                  src="/logo-square.webp"
                  alt="Colorful handmade Crochet PeakZ logo"
                  width={768}
                  height={768}
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 340px, 74vw"
                  priority
                  className="absolute top-[7%] right-[9%] left-[17%] z-10 h-[74%] w-[74%] rounded-[48%_48%_16%_16%] object-cover mix-blend-multiply dark:mix-blend-normal dark:shadow-md"
                />
                <div className="absolute left-[1%] top-[10%] z-20 flex size-[4.75rem] -rotate-12 items-center justify-center rounded-full border border-accent/80 bg-background/90 text-center font-sans text-[9px] font-semibold uppercase leading-snug tracking-[0.14em] text-highlight sm:left-[2%] sm:top-[11%] sm:size-24 sm:text-[10px]">
                  Handmade
                  <br />
                  with care
                </div>
                <p className="absolute bottom-[2%] right-[1%] z-20 max-w-[11.5rem] rotate-3 rounded-[2px] border border-border/60 bg-card px-3.5 py-2.5 font-heading text-[13px] leading-snug text-card-foreground shadow-lg sm:bottom-[5%] sm:right-[2%] sm:max-w-[14.5rem] sm:px-4 sm:py-3 sm:text-base sm:leading-snug">
                  Your next favorite thing is being made.
                </p>
              </div>
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

      <section className="border-t border-border">
        <Container>
          <Section>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-4">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
                  The PeakZ feeling
                </h2>
              </div>
              <div className="space-y-5 lg:col-span-8">
                <p className="font-heading text-2xl leading-snug text-foreground sm:text-3xl">
                  Every loop is a small act of patience. We make{" "}
                  <strong className="font-bold text-accent">
                    joyful, useful, one-of-a-kind things
                  </strong>{" "}
                  that bring a little more texture and warmth to everyday life.
                </p>
                <Link
                  href="/about"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 transition-colors duration-200 hover:text-primary-hover hover:underline motion-reduce:transition-none"
                >
                  Meet the maker
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Section>
        </Container>
      </section>

      <section className="border-t border-border bg-surface">
        <Container>
          <Section>
            <h2 className="sr-only">How we craft</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {featureCards.map((card) => (
                <article key={card.number}>
                  <Card className="h-full bg-card">
                    <CardContent className="space-y-3">
                      <span className="inline-block font-heading text-sm font-bold tracking-widest text-highlight">
                        {card.number}
                      </span>
                      <h3 className="font-heading text-xl font-semibold text-foreground">
                        {card.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {card.body}
                      </p>
                    </CardContent>
                  </Card>
                </article>
              ))}
            </div>
          </Section>
        </Container>
      </section>

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
              <Link href="/contact?topic=custom-order">
                Start a custom order
              </Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
