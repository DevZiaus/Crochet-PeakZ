import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Both design system routes are temporary browser fixtures for spec 0003. They
 * must stay out of search results until the real storefront and admin pages
 * replace them. Removal is tracked in docs/scope/scope.md.
 */
export default function DesignSystemLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
