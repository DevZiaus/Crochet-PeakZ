/**
 * Regression test for duplicate React keys in the footer link columns.
 *
 * "All Products" and "Custom Orders" both point at `/shop` until the custom
 * order flow ships, so the columns must key on the link label instead of the
 * destination.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Footer } from "./footer";

describe("Footer", () => {
  it("renders the link columns without duplicate React keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      render(<Footer />);

      const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
        String(call[0]).includes("same key"),
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});
