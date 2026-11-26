import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { DEFAULT_CONTACT_EMAIL } from "@crochet-peakz/shared";
import { Container } from "@/components/container";
import { Section } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";
import { getCatalogEnv } from "@/lib/catalog/env";

/**
 * Data Deletion instructions page metadata.
 *
 * @returns Page metadata with canonical URL and OpenGraph defaults.
 */
export function generateMetadata(): Metadata {
  const { webAppUrl } = getCatalogEnv();
  const title = "Data Deletion";
  const description =
    "How to request deletion of your personal data from Crochet PeakZ.";

  return {
    title,
    description,
    alternates: { canonical: `${webAppUrl}/data-deletion` },
    openGraph: {
      title,
      description,
      url: `${webAppUrl}/data-deletion`,
      images: [{ url: "/images/og-default.webp", alt: "Crochet PeakZ" }],
    },
  };
}

/**
 * Public Data Deletion instructions page inside the storefront layout.
 */
export default function DataDeletionPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="py-14 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
              You’re in control
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Want your data <em className="italic text-accent">deleted?</em>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              We’ll keep the process simple, clear, and respectful.
            </p>
          </div>
        </Container>
      </section>

      <Container>
        <Section>
          <article className="max-w-3xl space-y-8">
            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                How to request deletion
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Send us a message through the{" "}
                <Link
                  href="/contact?topic=data-deletion"
                  className="font-medium text-primary underline underline-offset-4 transition-colors duration-200 hover:text-primary-hover motion-reduce:transition-none"
                >
                  contact form
                </Link>{" "}
                using the{" "}
                <strong className="font-medium text-foreground">
                  Data deletion
                </strong>{" "}
                topic, or send an email to{" "}
                <a
                  href={`mailto:${DEFAULT_CONTACT_EMAIL}?subject=Data%20deletion%20request`}
                  className="font-medium text-primary underline underline-offset-4 transition-colors duration-200 hover:text-primary-hover motion-reduce:transition-none"
                >
                  {DEFAULT_CONTACT_EMAIL}
                </a>{" "}
                with the subject “Data deletion request”. Please include the
                email address or name connected to your request so we can find
                the right information.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                What happens next
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
                <li>We’ll confirm that we received your request.</li>
                <li>
                  We’ll remove personal information we control, unless we’re
                  legally required to keep specific records.
                </li>
                <li>We’ll let you know when the request is complete.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Need help?
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                If you’re unsure what to include, simply write to us and we’ll
                guide you. You can also return to our{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-primary underline underline-offset-4 transition-colors duration-200 hover:text-primary-hover motion-reduce:transition-none"
                >
                  privacy policy
                  <ArrowUpRight
                    className="ml-0.5 inline size-4 align-text-bottom"
                    aria-hidden="true"
                  />
                </Link>
                .
              </p>
            </section>

            <Card className="mt-12 bg-surface text-center">
              <CardContent className="flex flex-col items-center gap-3 py-2">
                <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-heading text-xl font-semibold text-foreground">
                  Your information belongs to you.
                </h3>
              </CardContent>
            </Card>
          </article>
        </Section>
      </Container>
    </>
  );
}
