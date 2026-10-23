import { Fragment, cloneElement, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  /** The label text for the field. */
  label: string;
  /** Optional description text below the label. */
  description?: string;
  /** Error message to display below the input. */
  error?: string;
  /**
   * Whether the field is required. Shows an asterisk indicator next to the
   * label and marks the control with `aria-required`.
   */
  required?: boolean;
  /**
   * The HTML id of the form control. Required so the label and the generated
   * description and error ids are always linked to the control.
   */
  htmlFor: string;
  /** The form control slot (Input, Textarea, Select, etc.). */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

type DescribedControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
};

/**
 * Form field wrapper that provides a consistent label, description, and error
 * message layout. The `htmlFor` id associates the label with the control, and
 * the wrapper links the description and error through `aria-describedby`. While
 * an error is shown the control is marked `aria-invalid`. The wrapper also sets
 * the control id to `htmlFor`, so the label cannot point at a missing element.
 * When `required` is set the control is marked `aria-required`, so assistive
 * technology announces the requirement instead of relying on the visual
 * asterisk alone.
 *
 * Composite controls that keep the focusable element inside another component
 * (such as Select) should put the same `htmlFor` id on their inner trigger and
 * add the generated `${htmlFor}-description` and `${htmlFor}-error` ids to its
 * `aria-describedby`, because the wrapper cannot reach that inner element.
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
  const descriptionId = `${htmlFor}-description`;
  const errorId = `${htmlFor}-error`;
  const describedBy = [
    description ? descriptionId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const control =
    isValidElement<DescribedControlProps>(children) &&
    children.type !== Fragment
      ? cloneElement(children, {
          id: htmlFor,
          "aria-describedby":
            [children.props["aria-describedby"], describedBy]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : children.props["aria-invalid"],
          "aria-required": required ? true : children.props["aria-required"],
        })
      : children;

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none text-foreground"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {control}

      {error && (
        <p
          id={errorId}
          className="text-xs font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
export type { FormFieldProps };
