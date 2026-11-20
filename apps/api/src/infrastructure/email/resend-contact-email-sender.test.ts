import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactDeliveryError } from "../../domain/contact/contact-email-sender.js";
import type { ContactMessage } from "../../domain/contact/contact-message.js";
import {
  composeContactEmail,
  type ComposedContactEmail,
} from "./contact-email-template.js";
import { ResendContactEmailSender } from "./resend-contact-email-sender.js";

const FROM = "Crochet PeakZ <no-reply@crochetpeakz.tech>";
const TO = "hello@crochetpeakz.tech";

function makeMessage(overrides: Partial<ContactMessage> = {}): ContactMessage {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    topic: "custom-order",
    topicLabel: "Custom order & commission",
    message: "Hello!\nI would like a custom scarf.",
    submittedAt: new Date("2026-11-20T12:00:00.000Z"),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("composeContactEmail", () => {
  it("renders subject, replyTo, headers, escaped HTML, and plain text", () => {
    const email = composeContactEmail({
      from: FROM,
      to: TO,
      message: makeMessage({
        name: "Ada\r\n<script>alert(1)</script>",
        message: "Line 1 & <tag>\nLine 2 \"quoted\" 'single'",
      }),
    });

    expect(email.from).toBe(FROM);
    expect(email.to).toEqual([TO]);
    expect(email.replyTo).toBe("ada@example.com");
    expect(email.subject).toBe(
      "New contact message: Custom order & commission (Ada <script>alert(1)</script>)",
    );
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.headers).toEqual({
      "X-Contact-Form-Submitted-At": "2026-11-20T12:00:00.000Z",
    });
    expect(email.idempotencyKey).toMatch(/^contact\/[a-f0-9]{64}$/);
    expect(email.idempotencyKey.length).toBeLessThan(256);
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).toContain(
      "Line 1 &amp; &lt;tag&gt;<br />Line 2 &quot;quoted&quot; &#39;single&#39;",
    );
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("Topic: Custom order & commission");
    expect(email.text).toContain("Line 1 & <tag>\nLine 2 \"quoted\" 'single'");
  });
});

describe("ResendContactEmailSender", () => {
  it("passes the composed envelope to the injected transport", async () => {
    const sent: ComposedContactEmail[] = [];
    const sender = new ResendContactEmailSender({
      apiKey: "re_test_key",
      from: FROM,
      to: TO,
      transport: (email) => {
        sent.push(email);
        return Promise.resolve({ error: null });
      },
    });

    await sender.sendContactMessage(makeMessage());

    expect(sent).toHaveLength(1);
    expect(sent[0]?.from).toBe(FROM);
    expect(sent[0]?.to).toEqual([TO]);
    expect(sent[0]?.replyTo).toBe("ada@example.com");
  });

  it("throws ContactDeliveryError when Resend returns an API error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sender = new ResendContactEmailSender({
      apiKey: "re_test_key",
      from: FROM,
      to: TO,
      transport: () =>
        Promise.resolve({
          error: { name: "validation_error", message: "domain not verified" },
        }),
    });

    await expect(sender.sendContactMessage(makeMessage())).rejects.toThrow(
      ContactDeliveryError,
    );
  });

  it("throws ContactDeliveryError when the transport throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sender = new ResendContactEmailSender({
      apiKey: "re_test_key",
      from: FROM,
      to: TO,
      transport: () => Promise.reject(new Error("network down")),
    });

    await expect(sender.sendContactMessage(makeMessage())).rejects.toThrow(
      ContactDeliveryError,
    );
  });
});
