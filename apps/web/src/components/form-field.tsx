import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  /** The label text for the field. */
  label: string;
  /** Optional description text below the label. */
  description?: string;
  /** Error message to display below the input. */
  error?: string;
  /** Whether the field is required. Shows an asterisk indicator. */
  required?: boolean;
  /** The HTML id of the input element (for label association). */
  htmlFor?: string;
  /** The form control slot (Input, Textarea, Select, etc.). */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Form field wrapper that provides a consistent label, description,
 * and error message layout for any form control. Associates the label
 * with the input via htmlFor for accessibility.
 */
function FormField({
  label,
  description,
  error,
  required = false,
  htmlFor,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {children}

      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
export type { FormFieldProps };
