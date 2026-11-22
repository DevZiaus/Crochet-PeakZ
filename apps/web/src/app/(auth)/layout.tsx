import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sparkles, Truck, ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BrandLogo } from "@/components/brand-logo";
import { Container } from "@/components/container";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const assurances = [
  {
    icon: Sparkles,
    title: "Made by hand, kept for years",
    body: "Every piece is crocheted to order in small batches, with wool and cotton chosen for daily use.",
  },
  {
    icon: Truck,
    title: "Tracked delivery worldwide",
    body: "See each order stage, from the first stitch to the courier, in your account.",
  },
  {
    icon: ShieldCheck,
    title: "Patterns you keep",
    body: "Digital patterns stay in your library, ready to download whenever you need them.",
  },
] as const;

/**
 * Shell for the six auth screens.
 *
 * Header and footer keep the storefront close at hand, while the card holds the
 * form at a readable measure. The brand panel is decorative context that only
 * appears when there is room for it, so the form stays first on small screens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <Header />

      <main id="main-content" className="flex-1 py-10 sm:py-16">
        <Container>
          <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <aside className="hidden lg:block">
              <BrandLogo size="md" />
              <h2 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-foreground">
                Handmade pieces, kept in one place.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Sign in to follow an order, revisit a pattern, or pick up a
                custom commission exactly where you left it.
              </p>

              <ul className="mt-8 space-y-5">
                {assurances.map((item) => (
                  <li key={item.title} className="flex gap-4">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <item.icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
              {children}
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
