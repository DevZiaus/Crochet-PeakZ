import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  /** The visible label. */
  label: string;
  /** The route path. If omitted, the item is not a link (current page). */
  href?: string;
}

interface BreadcrumbsProps {
  /** Ordered list of breadcrumb items, from root to current page. */
  items: BreadcrumbItem[];
  /** Additional CSS class names. */
  className?: string;
  /** Whether to show a home icon as the first item. Defaults to true. */
  showHome?: boolean;
}

/**
 * Horizontal breadcrumb trail for page hierarchy navigation.
 * The last item is rendered as the current page (not a link).
 * Uses semantic `nav` + `ol` with `aria-label` for accessibility.
 */
function Breadcrumbs({ items, className, showHome = true }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {showHome && (
          <>
            <li>
              <Link
                href="/"
                className="inline-flex size-11 items-center justify-center rounded transition-colors duration-200 hover:text-foreground motion-reduce:transition-none"
                aria-label="Home"
              >
                <Home className="size-4" aria-hidden="true" />
              </Link>
            </li>
            {items.length > 0 && (
              <li aria-hidden="true">
                <ChevronRight className="size-3.5 text-muted-foreground/60" />
              </li>
            )}
          </>
        )}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={item.label}>
              <li>
                {isLast || !item.href ? (
                  <span
                    className="font-medium text-foreground"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded px-2 transition-colors duration-200 hover:text-foreground motion-reduce:transition-none"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5 text-muted-foreground/60" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
export type { BreadcrumbItem, BreadcrumbsProps };
