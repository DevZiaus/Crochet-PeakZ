import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  ContactDeliveryError,
  type ContactEmailSender,
} from "../../domain/contact/contact-email-sender.js";
import {
  ContactRejectionError,
  type ContactMessage,
} from "../../domain/contact/contact-message.js";
import type {
  ContactRateLimitResult,
  ContactRateLimiter,
} from "../../domain/contact/contact-rate-limiter.js";
import {
  ContactRateLimitError,
  formatRetryWaitMessage,
  submitContact,
} from "./submit-contact.js";

class InMemoryContactEmailSender implements ContactEmailSender {
  public readonly sent: ContactMessage[] = [];
  public nextError: Error | null = null;

  sendContactMessage(message: ContactMessage): Promise<void> {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      return Promise.reject(err);
    }
    this.sent.push(message);
    return Promise.resolve();
  }
}

class RecordingRateLimiter implements ContactRateLimiter {
  public readonly consumedKeys: string[] = [];
  public releaseCount = 0;
  public denyWithSeconds: number | null = null;

  consume(key: string): ContactRateLimitResult {
    this.consumedKeys.push(key);
    if (this.denyWithSeconds !== null) {
      return { allowed: false, retryAfterSeconds: this.denyWithSeconds };
    }
    return {
      allowed: true,
      release: () => {
        this.releaseCount += 1;
      },
    };
  }
}

const VALID_INPUT = {
  name: "  Ada Lovelace  ",
  email: "ada@example.com",
  topic: "custom-order",
  message: "  I would love a custom cardigan!  ",
  website: "",
  elapsedMs: 5000,
};

const NOW = new Date("2026-11-22T12:00:00.000Z");

describe("formatRetryWaitMessage", () => {
  it("uses singular and plural minute labels cleanly", () => {
    expect(formatRetryWaitMessage(1)).toBe(
      "Please wait about 1 minute before sending another message.",
    );
    expect(formatRetryWaitMessage(60)).toBe(
      "Please wait about 1 minute before sending another message.",
    );
    expect(formatRetryWaitMessage(61)).toBe(
      "Please wait about 2 minutes before sending another message.",
    );
  });
});

describe("submitContact", () => {
  it("validates, consumes a slot, and delivers the normalized contact message", async () => {
    const emails = new InMemoryContactEmailSender();
    const rateLimiter = new RecordingRateLimiter();

    await submitContact(
      {
        emails,
        clock: { now: () => NOW },
        rateLimiter,
      },
      { rawInput: VALID_INPUT, clientKey: "203.0.113.5" },
    );

    expect(rateLimiter.consumedKeys).toEqual(["203.0.113.5"]);
    expect(rateLimiter.releaseCount).toBe(0);
    expect(emails.sent).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        topic: "custom-order",
        topicLabel: "Custom order & commission",
        message: "I would love a custom cardigan!",
        submittedAt: NOW,
      },
    ]);
  });

  it("rejects schema and anti-spam failures without consuming a rate-limit slot", async () => {
    const emails = new InMemoryContactEmailSender();
    const rateLimiter = new RecordingRateLimiter();

    await expect(
      submitContact(
        { emails, clock: { now: () => NOW }, rateLimiter },
        {
          rawInput: { ...VALID_INPUT, email: "bad" },
          clientKey: "198.51.100.1",
        },
      ),
    ).rejects.toBeInstanceOf(ZodError);

    await expect(
      submitContact(
        { emails, clock: { now: () => NOW }, rateLimiter },
        {
          rawInput: { ...VALID_INPUT, website: "https://bot.test" },
          clientKey: "198.51.100.1",
        },
      ),
    ).rejects.toBeInstanceOf(ContactRejectionError);

    expect(rateLimiter.consumedKeys).toHaveLength(0);
    expect(emails.sent).toHaveLength(0);
  });

  it("throws ContactRateLimitError when throttled without attempting delivery", async () => {
    const emails = new InMemoryContactEmailSender();
    const rateLimiter = new RecordingRateLimiter();
    rateLimiter.denyWithSeconds = 125;

    let caught: unknown;
    try {
      await submitContact(
        { emails, clock: { now: () => NOW }, rateLimiter },
        { rawInput: VALID_INPUT, clientKey: "198.51.100.9" },
      );
      expect.unreachable("expected ContactRateLimitError");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ContactRateLimitError);
    expect((caught as ContactRateLimitError).code).toBe("RATE_LIMITED");
    expect((caught as ContactRateLimitError).retryAfterSeconds).toBe(125);
    expect((caught as ContactRateLimitError).message).toBe(
      "Please wait about 3 minutes before sending another message.",
    );
    expect(emails.sent).toHaveLength(0);
    expect(rateLimiter.releaseCount).toBe(0);
  });

  it("releases the consumed slot and surfaces ContactDeliveryError when sending fails", async () => {
    const emails = new InMemoryContactEmailSender();
    const rateLimiter = new RecordingRateLimiter();

    emails.nextError = new ContactDeliveryError("Resend 503");
    await expect(
      submitContact(
        { emails, clock: { now: () => NOW }, rateLimiter },
        { rawInput: VALID_INPUT, clientKey: "198.51.100.7" },
      ),
    ).rejects.toBeInstanceOf(ContactDeliveryError);
    expect(rateLimiter.releaseCount).toBe(1);

    emails.nextError = new Error("socket hang up");
    await expect(
      submitContact(
        { emails, clock: { now: () => NOW }, rateLimiter },
        { rawInput: VALID_INPUT, clientKey: "198.51.100.7" },
      ),
    ).rejects.toThrow("socket hang up");
    expect(rateLimiter.releaseCount).toBe(2);
  });
});
