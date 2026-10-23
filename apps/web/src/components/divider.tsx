import { cn } from "@/lib/utils";

interface DividerProps {
  /** Additional CSS class names. */
  className?: string;
  /** Optional text label to display in the center of the divider. */
  label?: string;
}

/**
 * Horizontal divider using the border token color.
 * Optionally displays a centered label (like "or" between sections).
 */
function Divider({ className, label }: DividerProps) {
  if (label) {
    return (
      <div
        className={cn("flex items-center gap-4", className)}
        role="separator"
      >
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return <hr className={cn("border-t border-border", className)} />;
}

export { Divider };
export type { DividerProps };
