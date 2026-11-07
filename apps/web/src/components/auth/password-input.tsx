"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Password input with a show/hide toggle.
 *
 * The toggle is a real button with an accessible label, and the input keeps
 * every prop `FormField` passes down (id, aria-describedby, aria-invalid).
 */
export function PasswordInput(props: React.ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className="pr-12"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setVisible((prev) => !prev);
        }}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1 -translate-y-1/2"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
