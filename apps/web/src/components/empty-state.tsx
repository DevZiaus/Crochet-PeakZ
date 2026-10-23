import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** The icon to display. Defaults to PackageOpen. */
  icon?: LucideIcon;
  /** The heading text. */
  heading: string;
  /** The description text below the heading. */
  description?: string;
  /** Optional call to action button. Provide both label and onClick. */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional custom content to render below the description. */
  children?: ReactNode;
  /** Additional CSS class names for the container. */
  className?: string;
}

/**
 * Centered empty state placeholder for lists, search results, or any
 * content area with no data. Displays an icon, heading, optional description,
 * and optional CTA button, all styled with design tokens.
 */
function EmptyState({
  icon: Icon = PackageOpen,
  heading,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Icon className="size-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{heading}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
