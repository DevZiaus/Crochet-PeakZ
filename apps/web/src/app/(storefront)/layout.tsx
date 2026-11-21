import type { ReactNode } from "react";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getActiveCurrency } from "@/lib/currency/server";

/**
 * Public storefront shell.
 *
 * Reads the active currency cookie once on the server, wraps the storefront
 * subtree in `CurrencyProvider`, and frames every catalog page with the
 * header and footer (AC-1, AC-9).
 */
export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const activeCurrency = await getActiveCurrency();

  return (
    <CurrencyProvider currency={activeCurrency}>
      <div className="flex min-h-full flex-1 flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </CurrencyProvider>
  );
}
