import { Loader2 } from "lucide-react";

/**
 * Neutral placeholder while a client auth form hydrates.
 *
 * The forms read query parameters, so each page renders them inside a
 * `Suspense` boundary. This keeps the reserved space calm instead of jumping
 * when the form appears.
 */
export function AuthFormFallback() {
  return (
    <div
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="size-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>Loading…</span>
    </div>
  );
}
