import { TriangleAlertIcon } from "lucide-react";
import { RetryButton } from "@/components/catalog/retry-button";

/** Props for the catalog error state. */
export interface CatalogErrorStateProps {
  heading: string;
  description: string;
}

/** Retryable error panel used when a catalog request fails. */
export function CatalogErrorState({
  heading,
  description,
}: CatalogErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-16 text-center"
    >
      <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {heading}
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      <div className="mt-6">
        <RetryButton />
      </div>
    </div>
  );
}
