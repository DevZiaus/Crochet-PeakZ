import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The page title, rendered as an h1. */
  title: string;
  /** Optional subtitle or description beneath the title. */
  description?: string;
  /** Optional actions or breadcrumbs to display in the header area. */
  children?: ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Page level header with title, optional description, and action slot.
 * Uses Playfair Display via the heading font family for the title.
 */
function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-2 pb-8", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-base text-muted-foreground">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
