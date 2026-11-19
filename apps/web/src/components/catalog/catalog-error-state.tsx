import { TriangleAlertIcon } from "lucide-react";
import { RetryButton } from "@/components/catalog/retry-button";

/** Props for the catalog error state. */
export interface CatalogErrorStateProps {
  heading: string;
  description: string;
  /**
   * Heading level for the panel. Page level error branches pass `h1` because
   * the normal page heading is not rendered; nested panels keep the default.
   */
  headingLevel?: "h1" | "h2";
}

/** Retryable error panel used when a catalog request fails. */
export function CatalogErrorState({
  heading,
  description,
  headingLevel: Heading = "h2",
}: CatalogErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-16 text-center"
    >
      <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon aria-hidden="true" className="size-6" />
      </span>
      <Heading className="font-heading text-2xl font-bold text-foreground">
        {heading}
      </Heading>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      <div className="mt-6">
        <RetryButton />
      </div>
    </div>
  );
}
