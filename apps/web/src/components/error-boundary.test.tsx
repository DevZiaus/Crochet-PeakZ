import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorInfo } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./error-boundary";

const boom = new Error("internal detail: database rejected the query");

function ThrowingChild(): never {
  throw boom;
}

beforeEach(() => {
  // React also prints caught errors; keep the test output quiet.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ErrorBoundary", () => {
  it("logs the error and component stack by default", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    const ownCall = vi
      .mocked(console.error)
      .mock.calls.find(([error]) => error === boom);

    expect(ownCall).toBeDefined();
    expect(ownCall?.[1]).toEqual(expect.any(String));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("still forwards the error to onError when provided", () => {
    const onError = vi.fn<(error: Error, errorInfo: ErrorInfo) => void>();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const call = onError.mock.calls[0];
    expect(call?.[0]).toBe(boom);
    expect(typeof call?.[1].componentStack).toBe("string");
  });

  it("shows the raw error message outside production", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/internal detail/)).toBeInTheDocument();
  });

  it("hides internal error text in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("An unexpected error occurred. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
  });

  it("recovers when the retry button is pressed", async () => {
    const user = userEvent.setup();
    let failing = true;

    function RecoverableChild() {
      if (failing) throw boom;
      return <p>Recovered content</p>;
    }

    render(
      <ErrorBoundary>
        <RecoverableChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });
});
