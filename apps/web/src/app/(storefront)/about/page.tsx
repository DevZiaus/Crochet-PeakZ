import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart, Wand2 } from "lucide-react";
import { Container } from "@/components/container";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCatalogEnv } from "@/lib/catalog/env";

/**
 * About page metadata.
 *
 * @returns Page metadata with canonical URL and OpenGraph defaults.
 */
export function generateMetadata(): Metadata {
  const { webAppUrl } = getCatalogEnv();
  const title = "Our Story";
  const description =
    "Learn about Crochet PeakZ — a handmade crochet fashion, lifestyle, and pattern studio crafting small-batch pieces with intention.";

  return {
    title,
    description,
    alternates: { canonical: `${webAppUrl}/about` },
    openGraph: {
      title,
      description,
      url: `${webAppUrl}/about`,
      images: [{ url: "/images/og-default.webp", alt: "Crochet PeakZ" }],
    },
  };
}

const values = [
  {
    icon: Heart,
    title: "Warmth over perfection",
    body: "Handmade details are the point. Every stitch carries a little character.",
  },
  {
    icon: Wand2,
    title: "Curiosity in every loop",
    body: "We keep learning, experimenting, and making room for joyful surprises.",
  },
] as const;

/**
 * Public About Us page inside the storefront layout.
 */
export default function AboutPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="py-14 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
              A little about us
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Crafted with care.{" "}
              <em className="italic text-accent">Shared with joy.</em>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Crochet PeakZ is a handmade fashion and lifestyle studio built
              around the magic of making something with your own two hands.
            </p>
          </div>
        </Container>
      </section>

      <Container>
        <Section>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
                Our why
              </p>
              <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                There’s magic in the{" "}
                <em className="italic text-accent">making.</em>
              </h2>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <p className="text-base leading-relaxed text-foreground">
                Crochet PeakZ began with a simple belief: the things we surround
                ourselves with should feel personal. A little imperfect. Made
                with intention.
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                We’re creating a place for handmade pieces that add warmth to
                your wardrobe, your home, and your everyday rituals — alongside
                patterns and guides for anyone ready to pick up a hook and make
                their own magic.
              </p>

              <blockquote className="rounded-r-lg border-l-2 border-accent bg-surface px-6 py-4 font-heading text-lg italic text-foreground">
                “Feel the handmade love” is more than a tagline. It’s how we
                want every piece to feel.
              </blockquote>

              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                {values.map((value) => (
                  <Card key={value.title} className="bg-card">
                    <CardContent className="space-y-3">
                      <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <value.icon className="size-5" aria-hidden="true" />
                      </span>
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {value.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {value.body}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
                <Button asChild size="lg">
                  <Link href="/shop">
                    Explore the shop
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact">Get in touch</Link>
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </Container>
    </>
  );
}
