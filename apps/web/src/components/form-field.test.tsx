import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";
import { Input } from "./ui/input";

describe("FormField", () => {
  it("links the label, description, and error to the control", () => {
    render(
      <FormField
        label="Email"
        htmlFor="email"
        description="We only use this for order updates."
        error="Enter a valid email address."
      >
        <Input type="email" />
      </FormField>,
    );

    const input = screen.getByLabelText("Email");

    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "email-description email-error",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("email-description")).toHaveTextContent(
      "We only use this for order updates.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
  });

  it("keeps a caller supplied description and leaves the control valid without an error", () => {
    render(
      <FormField
        label="Notes"
        htmlFor="notes"
        description="Anything you want added to this order."
      >
        <Input aria-describedby="external-hint" />
      </FormField>,
    );

    const input = screen.getByLabelText("Notes");

    expect(input).toHaveAttribute("id", "notes");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "external-hint notes-description",
    );
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control aria-required when the field is required", () => {
    render(
      <FormField label="Email" htmlFor="email" required>
        <Input type="email" />
      </FormField>,
    );

    const input = document.getElementById("email");
    if (!input) throw new Error("email control missing");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("leaves the control not required when the field is optional", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input type="email" />
      </FormField>,
    );

    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-required");
  });

  it("keeps a caller supplied aria-required when the field is optional", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input type="email" aria-required="true" />
      </FormField>,
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-required",
      "true",
    );
  });
});
