import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Props for the numbered catalog pagination. */
export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Builds the href for a given page while preserving the active filters. */
  hrefForPage: (page: number) => string;
  className?: string;
}

function getPageItems(page: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const candidates = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...candidates]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "gap"> = [];
  pages.forEach((candidate, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && candidate - previous > 1) {
      items.push("gap");
    }
    items.push(candidate);
  });
  return items;
}

/** Accessible numbered pagination that preserves the active filters. */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
  className,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPageItems(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex justify-center", className)}
    >
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link
                href={hrefForPage(page - 1)}
                rel="prev"
                className="min-h-11 gap-1 px-4"
              >
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sr-only sm:hidden">Previous page</span>
              </Link>
            </Button>
          ) : (
            <span
              aria-disabled="true"
              className="flex min-h-11 items-center gap-1 rounded-full border border-border px-4 text-sm text-muted-foreground opacity-50"
            >
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Previous</span>
            </span>
          )}
        </li>

        {items.map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${String(index)}`} aria-hidden="true">
              <span className="flex size-11 items-center justify-center text-sm text-muted-foreground">
                &hellip;
              </span>
            </li>
          ) : (
            <li key={item}>
              <Button
                asChild
                variant={item === page ? "default" : "outline"}
                size="icon"
              >
                <Link
                  href={hrefForPage(item)}
                  aria-label={`Page ${String(item)}`}
                  aria-current={item === page ? "page" : undefined}
                  className="size-11"
                >
                  {item}
                </Link>
              </Button>
            </li>
          ),
        )}

        <li>
          {page < totalPages ? (
            <Button asChild variant="outline">
              <Link
                href={hrefForPage(page + 1)}
                rel="next"
                className="min-h-11 gap-1 px-4"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sr-only sm:hidden">Next page</span>
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          ) : (
            <span
              aria-disabled="true"
              className="flex min-h-11 items-center gap-1 rounded-full border border-border px-4 text-sm text-muted-foreground opacity-50"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
