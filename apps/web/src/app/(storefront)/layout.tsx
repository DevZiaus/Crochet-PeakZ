import type { ReactNode } from "react";
import { SessionProvider } from "@/components/auth/session-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getActiveCurrency } from "@/lib/currency/server";

/**
 * Public storefront shell.
 *
 * Reads the active currency cookie once on the server, wraps the storefront
 * subtree in `SessionProvider`, `CurrencyProvider`, and `CartProvider`, and
 * frames every catalog page with the header, cart drawer, and footer.
 */
export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const activeCurrency = await getActiveCurrency();

  return (
    <SessionProvider>
      <CurrencyProvider currency={activeCurrency}>
        <CartProvider>
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
            <CartDrawer />
          </div>
        </CartProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}
