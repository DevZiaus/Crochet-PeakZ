import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./contact-form";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ContactForm", () => {
  it("exposes accessible fields and keeps the honeypot hidden from assistive tech", () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Topic/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();

    const honeypot = document.getElementById("contact-website");
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("shows inline validation errors without submitting when required fields are invalid", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/Email/), "not-an-email");
    await user.type(screen.getByLabelText(/Message/), "hi");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/Email/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/Message/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3);
  });

  it("submits valid messages, resets inputs, and renders a confirmation status", async () => {
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      clock += 4000;
      return clock;
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/Name/), "Ada Lovelace");
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(
      screen.getByLabelText(/Message/),
      "Could I commission a custom teal shawl?",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /Thank you for reaching out/,
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contact");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(typeof init.body === "string" ? init.body : "") as {
      name: string;
      email: string;
      topic: string;
      message: string;
      website: string;
      elapsedMs: number;
    };
    expect(sent).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      topic: "general",
      message: "Could I commission a custom teal shawl?",
      website: "",
    });
    expect(sent.elapsedMs).toBeGreaterThanOrEqual(3000);

    expect(screen.getByLabelText(/Name/)).toHaveValue("");
    expect(screen.getByLabelText(/Email/)).toHaveValue("");
    expect(screen.getByLabelText(/Message/)).toHaveValue("");
  });

  it("surfaces API error messages and keeps user input when delivery fails", async () => {
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      clock += 4000;
      return clock;
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message:
              "Please wait about 5 minutes before sending another message.",
            statusCode: 429,
          },
        }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/Name/), "Ada Lovelace");
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(
      screen.getByLabelText(/Message/),
      "Testing rate limit handling.",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please wait about 5 minutes before sending another message.",
      );
    });
    expect(screen.getByLabelText(/Message/)).toHaveValue(
      "Testing rate limit handling.",
    );
  });
});
