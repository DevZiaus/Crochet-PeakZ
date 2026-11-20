import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DEFAULT_CONTACT_EMAIL } from "@crochet-peakz/shared";
import { Container } from "@/components/container";
import { Section } from "@/components/section";
import { getCatalogEnv } from "@/lib/catalog/env";

/**
 * Privacy Policy page metadata.
 *
 * @returns Page metadata with canonical URL and OpenGraph defaults.
 */
export function generateMetadata(): Metadata {
  const { webAppUrl } = getCatalogEnv();
  const title = "Privacy Policy";
  const description =
    "Read how Crochet PeakZ collects, uses, and protects your personal information.";

  return {
    title,
    description,
    alternates: { canonical: `${webAppUrl}/privacy` },
    openGraph: {
      title,
      description,
      url: `${webAppUrl}/privacy`,
      images: [{ url: "/images/og-default.webp", alt: "Crochet PeakZ" }],
    },
  };
}

/**
 * Public Privacy Policy page inside the storefront layout.
 */
export default function PrivacyPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="py-14 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              The important stuff
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Privacy, in <em className="italic text-primary">plain words.</em>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              We believe in being clear about what information we collect and
              why.
            </p>
          </div>
        </Container>
      </section>

      <Container>
        <Section>
          <article className="max-w-3xl space-y-8">
            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                What we collect
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                When you contact us, create an account, or place an order, we
                may receive the information you choose to share, such as your
                name, email address, and message. We use it to respond to you
                and provide the help or service you requested.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                How we use information
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                We use information to communicate with you, understand interest
                in Crochet PeakZ, improve this website, and prepare future
                products and services. We do not sell your personal information.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Cookies and measurement
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                This website may use essential browser storage and, when
                enabled, Meta Pixel to understand visits and measure marketing
                performance. You can control cookies through your browser
                settings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Third parties
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Links to services such as Facebook and Instagram are provided
                for your convenience. Those services have their own privacy
                practices, which we encourage you to review before sharing
                information with them.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Your choices
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                You can ask what personal information we have about you, request
                a correction, or ask us to delete it by emailing{" "}
                <a
                  href={`mailto:${DEFAULT_CONTACT_EMAIL}`}
                  className="font-medium text-primary underline underline-offset-4 transition-colors duration-200 hover:text-primary-hover motion-reduce:transition-none"
                >
                  {DEFAULT_CONTACT_EMAIL}
                </a>{" "}
                or following our{" "}
                <Link
                  href="/data-deletion"
                  className="font-medium text-primary underline underline-offset-4 transition-colors duration-200 hover:text-primary-hover motion-reduce:transition-none"
                >
                  data deletion instructions
                  <ArrowUpRight
                    className="ml-0.5 inline size-4 align-text-bottom"
                    aria-hidden="true"
                  />
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Updates
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                We may update this policy as the website grows. The latest
                version will always be published on this page.
              </p>
            </section>
          </article>
        </Section>
      </Container>
    </>
  );
}
