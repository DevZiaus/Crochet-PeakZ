"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Props for the catalog retry button. */
export interface RetryButtonProps {
  label?: string;
}

/** Re runs the current server render so a failed catalog request can recover. */
export function RetryButton({ label = "Try again" }: RetryButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      onClick={() => {
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
