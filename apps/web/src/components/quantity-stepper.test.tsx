import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityStepper } from "./quantity-stepper";

describe("QuantityStepper", () => {
  it("increments and decrements within the range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} min={1} max={3} />);

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onChange).toHaveBeenLastCalledWith(3);

    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("disables the buttons at the lower and upper bounds", () => {
    const { rerender } = render(
      <QuantityStepper value={1} onChange={() => undefined} min={1} max={3} />,
    );

    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeEnabled();

    rerender(
      <QuantityStepper value={3} onChange={() => undefined} min={1} max={3} />,
    );

    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeEnabled();
  });

  it("clamps a value that is outside the range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <QuantityStepper value={0} onChange={onChange} min={1} max={3} />,
    );

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    rerender(<QuantityStepper value={5} onChange={onChange} min={1} max={3} />);

    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(onChange).toHaveBeenLastCalledWith(3);
  });
});
