"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CART_LOAD_ERROR_MESSAGE } from "@/lib/cart/labels";

/** Props for {@link CartErrorState}. */
export interface CartErrorStateProps {
  /** Called when the shopper clicks `Try again`. */
  onRetry: () => void;
  /** True while a retry request is in flight. */
  retrying?: boolean;
}

/**
 * Error surface displayed in the drawer and `/cart` when live validation
 * fails; preserves saved items and offers a manual retry (AC-14).
 */
export function CartErrorState({
  onRetry,
  retrying = false,
}: CartErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">
          {CART_LOAD_ERROR_MESSAGE}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your saved items have not been changed. Check your connection and try
          again.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={retrying}
        onClick={onRetry}
        className="min-h-[44px]"
      >
        <RotateCw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
