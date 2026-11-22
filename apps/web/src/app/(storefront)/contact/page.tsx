import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { DEFAULT_CONTACT_EMAIL, isContactTopic } from "@crochet-peakz/shared";
import { ContactForm } from "@/components/contact-form";
import { Container } from "@/components/container";
import { FacebookIcon, InstagramIcon } from "@/components/footer";
import { Section } from "@/components/section";
import { getCatalogEnv } from "@/lib/catalog/env";

/**
 * Contact page metadata.
 *
 * @returns Page metadata with canonical URL and OpenGraph defaults.
 */
export function generateMetadata(): Metadata {
  const { webAppUrl } = getCatalogEnv();
  const title = "Contact";
  const description =
    "Send a note to CrocheT PeakZ about custom crochet orders, patterns, shipping, or collaborations.";

  return {
    title,
    description,
    alternates: { canonical: `${webAppUrl}/contact` },
    openGraph: {
      title,
      description,
      url: `${webAppUrl}/contact`,
      images: [{ url: "/images/og-default.webp", alt: "CrocheT PeakZ" }],
    },
  };
}

interface ContactPageProps {
  searchParams?: Promise<{ topic?: string | string[] }>;
}

/**
 * Public Contact page inside the storefront layout.
 */
export default async function ContactPage({
  searchParams,
}: ContactPageProps = {}) {
  const params = searchParams ? await searchParams : undefined;
  const rawTopic = Array.isArray(params?.topic)
    ? params.topic[0]
    : params?.topic;
  const initialTopic =
    rawTopic && isContactTopic(rawTopic) ? rawTopic : undefined;

  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="py-14 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
              Come say hello
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Let’s make something{" "}
              <em className="italic text-accent">lovely.</em>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Have a question, an idea, or just want to share some handmade
              love? We’d be happy to hear from you.
            </p>
          </div>
        </Container>
      </section>

      <Container>
        <Section>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="space-y-6 lg:col-span-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">
                  Get in touch
                </p>
                <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  We’re all <em className="italic text-accent">ears.</em>
                </h2>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  Whether you’re curious about a custom piece or want to follow
                  the journey, send us a note and we’ll get back to you as soon
                  as we can.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email
                  </p>
                  <a
                    href={`mailto:${DEFAULT_CONTACT_EMAIL}`}
                    className="mt-1 inline-flex min-h-11 items-center gap-2 text-base font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline motion-reduce:transition-none"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden="true" />
                    {DEFAULT_CONTACT_EMAIL}
                  </a>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Social
                  </p>
                  <div className="mt-1 flex flex-col items-start">
                    <a
                      href="https://www.facebook.com/crochet.peakz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline motion-reduce:transition-none"
                    >
                      <FacebookIcon
                        className="size-4 shrink-0 text-facebook"
                        aria-hidden="true"
                      />
                      Facebook / crochet.peakz
                    </a>
                    <a
                      href="https://www.instagram.com/crochetpeakz/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline motion-reduce:transition-none"
                    >
                      <InstagramIcon
                        className="size-4 shrink-0 text-instagram"
                        aria-hidden="true"
                      />
                      Instagram / crochetpeakz
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <ContactForm initialTopic={initialTopic} />
            </div>
          </div>
        </Section>
      </Container>
    </>
  );
}
