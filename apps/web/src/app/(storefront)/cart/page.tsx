import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart/cart-page-content";

/** Cart page metadata: excluded from search engine indexing (AC-4, AC-17). */
export const metadata: Metadata = {
  title: "Shopping cart",
  robots: {
    index: false,
    follow: false,
  },
};

/** Full shopping cart page at `/cart`. */
export default function CartPage() {
  return <CartPageContent />;
}
