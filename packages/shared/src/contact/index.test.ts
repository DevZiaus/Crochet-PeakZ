import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL_MAX,
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  CONTACT_TOPIC_KEYS,
  CONTACT_TOPICS,
  DEFAULT_CONTACT_EMAIL,
  contactSubmissionSchema,
  isContactTopic,
} from "./index.js";

describe("contact shared contract", () => {
  it("exposes the default email and topic labels", () => {
    expect(DEFAULT_CONTACT_EMAIL).toBe("hello@crochetpeakz.tech");
    for (const key of CONTACT_TOPIC_KEYS) {
      expect(isContactTopic(key)).toBe(true);
      expect(CONTACT_TOPICS[key].length).toBeGreaterThan(0);
    }
    expect(isContactTopic("unknown-topic")).toBe(false);
    expect(isContactTopic("__proto__")).toBe(false);
  });

  it("validates and trims a valid contact submission", () => {
    const result = contactSubmissionSchema.safeParse({
      name: "  Ada Lovelace  ",
      email: "  ada@example.com ",
      topic: "custom-order",
      message: "  Hello, I would love a custom cardigan.  ",
      elapsedMs: 4200,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Ada Lovelace",
        email: "ada@example.com",
        topic: "custom-order",
        message: "Hello, I would love a custom cardigan.",
        website: "",
        elapsedMs: 4200,
      });
    }
  });

  it("rejects empty or oversized names", () => {
    const empty = contactSubmissionSchema.safeParse({
      name: "   ",
      email: "ada@example.com",
      topic: "general",
      message: "Hello there!",
    });
    expect(empty.success).toBe(false);

    const tooLong = contactSubmissionSchema.safeParse({
      name: "a".repeat(CONTACT_NAME_MAX + 1),
      email: "ada@example.com",
      topic: "general",
      message: "Hello there!",
    });
    expect(tooLong.success).toBe(false);
  });

  it("rejects invalid or oversized emails", () => {
    for (const badEmail of ["", "not-an-email", "a@b", "a @b.com"]) {
      const result = contactSubmissionSchema.safeParse({
        name: "Ada",
        email: badEmail,
        topic: "general",
        message: "Hello there!",
      });
      expect(result.success).toBe(false);
    }

    const oversized = `${"a".repeat(CONTACT_EMAIL_MAX)}@example.com`;
    const result = contactSubmissionSchema.safeParse({
      name: "Ada",
      email: oversized,
      topic: "general",
      message: "Hello there!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown topics", () => {
    const result = contactSubmissionSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      topic: "billing",
      message: "Hello there!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects messages shorter than 5 or longer than 5000 characters", () => {
    const tooShort = contactSubmissionSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      topic: "general",
      message: "  hi  ",
    });
    expect(tooShort.success).toBe(false);

    const tooLong = contactSubmissionSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      topic: "general",
      message: "x".repeat(CONTACT_MESSAGE_MAX + 1),
    });
    expect(tooLong.success).toBe(false);
  });
});
