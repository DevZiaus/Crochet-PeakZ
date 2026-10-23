import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  /** The content to wrap. */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
  /** HTML id for anchor linking or aria-labelledby. */
  id?: string;
}

/**
 * Vertical section wrapper with consistent vertical spacing.
 * Use inside a Container for storefront pages, or standalone in admin layout.
 */
function Section({ children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn("py-12 sm:py-16", className)}>
      {children}
    </section>
  );
}

export { Section };
export type { SectionProps };
