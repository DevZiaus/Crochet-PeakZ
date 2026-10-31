import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthEmail } from "../../domain/ports/email-sender.js";
import {
  composeAuthEmail,
  extractEmailUrl,
  type ComposedAuthEmail,
} from "./auth-email-templates.js";
import { ResendEmailSender } from "./resend-email-sender.js";

const FROM = "Crochet PeakZ <hello@crochetpeakz.com>";
const VERIFY_URL = "https://shop.example.com/verify-email?token=abc123";
const RESET_URL = "https://shop.example.com/reset-password?token=xyz789";

/** Builds a recipient and link for one message. */
function makeEmail(overrides: Partial<AuthEmail> = {}): AuthEmail {
  return {
    to: "ada@example.com",
    name: "Ada Lovelace",
    url: VERIFY_URL,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("composeAuthEmail", () => {
  it("builds the verification message with the configured sender", () => {
    const message = composeAuthEmail("verification", FROM, makeEmail());

    expect(message.from).toBe(FROM);
    expect(message.to).toEqual(["ada@example.com"]);
    expect(message.subject).toBe("Confirm your Crochet PeakZ email");
    expect(message.idempotencyKey).toBe("verify-email/ada@example.com");
    expect(message.text).toContain(VERIFY_URL);
    expect(message.html).toContain(VERIFY_URL);
    expect(message.html).toContain("Confirm my email");
  });

  it("builds the password reset message with the configured sender", () => {
    const message = composeAuthEmail(
      "password-reset",
      FROM,
      makeEmail({ url: RESET_URL }),
    );

    expect(message.from).toBe(FROM);
    expect(message.to).toEqual(["ada@example.com"]);
    expect(message.subject).toBe("Reset your Crochet PeakZ password");
    expect(message.idempotencyKey).toBe("reset-password/ada@example.com");
    expect(message.text).toContain(RESET_URL);
    expect(message.html).toContain(RESET_URL);
    expect(message.html).toContain("Choose a new password");
  });

  it("escapes HTML while keeping the plain text link intact", () => {
    const url = "https://shop.example.com/verify-email?token=a&label=<x>";
    const message = composeAuthEmail("verification", FROM, makeEmail({ url }));

    expect(message.text).toContain(url);
    expect(message.html).toContain(
      "https://shop.example.com/verify-email?token=a&amp;label=&lt;x&gt;",
    );
    expect(message.html).not.toContain("label=<x>");
  });

  it("extracts the action link from the plain text fallback", () => {
    expect(extractEmailUrl(`Confirm your email: ${VERIFY_URL}`)).toBe(
      VERIFY_URL,
    );
    expect(extractEmailUrl("no link here")).toBe("");
  });

  it("never lets a recipient name reach the markup", () => {
    // The template addresses the customer by action, not by name, so a name
    // taken from an OAuth profile cannot become markup in the body.
    const message = composeAuthEmail(
      "verification",
      FROM,
      makeEmail({ name: `Ada <script>alert("x")</script>` }),
    );

    expect(message.html).not.toContain("<script>");
    expect(message.html).not.toContain("Ada");
    expect(message.text).not.toContain("Ada");
  });

  it("addresses one recipient even when the name is empty", () => {
    const message = composeAuthEmail(
      "verification",
      FROM,
      makeEmail({ name: "" }),
    );

    expect(message.to).toEqual(["ada@example.com"]);
    expect(message.to).toHaveLength(1);
  });

  it("scopes the idempotency key to the recipient so a resend is distinct", () => {
    const first = composeAuthEmail("verification", FROM, makeEmail());
    const second = composeAuthEmail(
      "verification",
      FROM,
      makeEmail({ to: "grace@example.com" }),
    );

    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    expect(second.idempotencyKey).toBe("verify-email/grace@example.com");
  });

  it("keeps the two kinds on separate idempotency key prefixes", () => {
    const verification = composeAuthEmail("verification", FROM, makeEmail());
    const reset = composeAuthEmail("password-reset", FROM, makeEmail());

    expect(verification.idempotencyKey).not.toBe(reset.idempotencyKey);
    expect(reset.idempotencyKey).toBe("reset-password/ada@example.com");
  });

  it("carries the link in both bodies so the message is usable without HTML", () => {
    const message = composeAuthEmail("verification", FROM, makeEmail());

    expect(message.text).toContain(VERIFY_URL);
    expect(extractEmailUrl(message.text)).toBe(VERIFY_URL);
    expect(message.html).toContain(`href="${VERIFY_URL}"`);
  });

  it("renders an accessible document with a language and a heading", () => {
    const message = composeAuthEmail("verification", FROM, makeEmail());

    expect(message.html).toContain('<html lang="en">');
    expect(message.html).toContain("<h1");
    expect(message.html).toContain("Confirm your email");
  });

  it("uses presentation tables so the layout survives an email client", () => {
    const message = composeAuthEmail("verification", FROM, makeEmail());

    expect(message.html).toContain('role="presentation"');
    expect(message.html).not.toContain("<div");
  });
});

describe("ResendEmailSender", () => {
  it("hands EMAIL_FROM to the transport on both messages (S26)", async () => {
    const sent: ComposedAuthEmail[] = [];
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: FROM,
      logLinks: false,
      transport: (message) => {
        sent.push(message);
        return Promise.resolve({ error: null });
      },
    });

    await sender.sendVerificationEmail(makeEmail());
    await sender.sendPasswordResetEmail(makeEmail({ url: RESET_URL }));

    expect(sent).toHaveLength(2);
    expect(sent.map((message) => message.from)).toEqual([FROM, FROM]);
    expect(sent.map((message) => message.to)).toEqual([
      ["ada@example.com"],
      ["ada@example.com"],
    ]);
    expect(sent[0]?.text).toContain(VERIFY_URL);
    expect(sent[1]?.text).toContain(RESET_URL);
  });

  it("logs the link and does not throw when Resend rejects in development", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: FROM,
      logLinks: true,
      transport: () =>
        Promise.resolve({ error: { message: "domain is not verified" } }),
    });

    await expect(
      sender.sendVerificationEmail(makeEmail()),
    ).resolves.toBeUndefined();
    expect(info).toHaveBeenCalledWith(expect.stringContaining(VERIFY_URL));
  });

  it("throws when Resend rejects in production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: FROM,
      logLinks: false,
      transport: () =>
        Promise.resolve({ error: { message: "domain is not verified" } }),
    });

    await expect(sender.sendVerificationEmail(makeEmail())).rejects.toThrow(
      "domain is not verified",
    );
  });
});
