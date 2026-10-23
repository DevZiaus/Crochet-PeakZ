import { describe, expect, it } from "vitest";
import { badgeVariants } from "./badge";
import { buttonVariants } from "./button";

describe("design token variants", () => {
  it("uses the primary hover token for primary actions", () => {
    expect(buttonVariants({ variant: "default" })).toContain(
      "hover:bg-primary-hover",
    );
    expect(badgeVariants({ variant: "default" })).toContain(
      "[a&]:hover:bg-primary-hover",
    );
  });

  it("keeps the token focus ring on the destructive badge", () => {
    const classes = badgeVariants({ variant: "destructive" });

    expect(classes).toContain("focus-visible:ring-ring");
    expect(classes).not.toContain("ring-destructive");
  });
});
