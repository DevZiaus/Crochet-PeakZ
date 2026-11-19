"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";

interface StorefrontErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Storefront error boundary.
 *
 * Renders a retryable, token styled panel when a catalog page throws. API
 * failures are normally caught inside the page, so this covers unexpected
 * render errors.
 */
export default function StorefrontError({
  error,
  reset,
}: StorefrontErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center shadow-sm"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert
            className="size-7 text-destructive"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            We could not load this page
          </h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong on our side. Please try again.
          </p>
        </div>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </Container>
  );
}
