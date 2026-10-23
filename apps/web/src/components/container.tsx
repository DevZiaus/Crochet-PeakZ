import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps {
  /** The content to wrap. */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
  /** HTML element to render. Defaults to `div`. */
  as?: "div" | "section" | "main" | "article";
}

/**
 * Storefront max width container: 1280px centered with horizontal padding.
 * Used for all storefront page content to maintain consistent width.
 */
function Container({ children, className, as: Tag = "div" }: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export { Container };
export type { ContainerProps };
