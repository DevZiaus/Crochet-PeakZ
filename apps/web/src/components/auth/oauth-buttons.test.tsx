/**
 * Tests for the vertical OAuth provider links shown on sign in and register.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OAuthButtons } from "./oauth-buttons";

describe("OAuthButtons", () => {
  it("stacks Google and Facebook sign in links vertically with encoded next", () => {
    render(<OAuthButtons next="/orders" />);

    const googleLink = screen.getByRole("link", {
      name: "Continue with Google",
    });
    const facebookLink = screen.getByRole("link", {
      name: "Continue with Facebook",
    });

    expect(googleLink).toHaveAttribute(
      "href",
      "/api/auth/google?next=%2Forders",
    );
    expect(facebookLink).toHaveAttribute(
      "href",
      "/api/auth/facebook?next=%2Forders",
    );
    expect(googleLink).toHaveClass("w-full");
    expect(facebookLink).toHaveClass("w-full");

    const wrapper = googleLink.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper).toBe(facebookLink.parentElement);
    expect(wrapper).toHaveClass("flex", "flex-col");
    expect(wrapper).not.toHaveClass("sm:grid-cols-2");
  });
});
