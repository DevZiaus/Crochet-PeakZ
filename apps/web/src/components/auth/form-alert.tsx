import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Alert tone. */
export type FormAlertTone = "error" | "success" | "info";

interface FormAlertProps {
  /** Visual and semantic tone. */
  tone?: FormAlertTone;
  /** Message text. */
  children: React.ReactNode;
  /** Optional extra classes. */
  className?: string;
}

/**
 * Inline form message.
 *
 * Errors use `role="alert"` so assistive technology announces them as soon as
 * they appear. Success and info messages use a polite live region.
 */
export function FormAlert({
  tone = "error",
  children,
  className,
}: FormAlertProps) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 text-sm",
        tone === "error" &&
          "border-destructive/40 bg-destructive/10 text-foreground",
        tone === "success" && "border-success/40 bg-success/10 text-foreground",
        tone === "info" && "border-border bg-surface text-muted-foreground",
        className,
      )}
    >
      {isError ? (
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
      ) : (
        <CircleCheck
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "success" ? "text-success" : "text-primary",
          )}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
