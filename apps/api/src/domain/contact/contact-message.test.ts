import { describe, expect, it } from "vitest";
import {
  ContactRejectionError,
  countMessageLinks,
  createContactMessage,
} from "./contact-message.js";

const BASE_INPUT = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  topic: "general",
  topicLabel: "General inquiry",
  message: "Hello! Do you ship crochet cardigans internationally?",
  website: "",
  elapsedMs: 5000,
  minFillTimeMs: 3000,
  maxLinks: 3,
  submittedAt: new Date("2026-11-20T12:00:00.000Z"),
};

describe("createContactMessage", () => {
  it("accepts a legitimate contact submission", () => {
    const entity = createContactMessage(BASE_INPUT);

    expect(entity).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      topic: "general",
      topicLabel: "General inquiry",
      message: "Hello! Do you ship crochet cardigans internationally?",
      submittedAt: new Date("2026-11-20T12:00:00.000Z"),
    });
  });

  it("rejects submissions with a filled honeypot field", () => {
    expect(() =>
      createContactMessage({ ...BASE_INPUT, website: "https://spam.test" }),
    ).toThrow(ContactRejectionError);

    try {
      createContactMessage({ ...BASE_INPUT, website: "bot" });
    } catch (error) {
      expect(error).toBeInstanceOf(ContactRejectionError);
      expect((error as ContactRejectionError).code).toBe("HONEYPOT_FILLED");
    }
  });

  it("rejects submissions completed faster than the minimum fill time", () => {
    for (const elapsedMs of [0, 2999, Number.NaN, Number.POSITIVE_INFINITY]) {
      try {
        createContactMessage({ ...BASE_INPUT, elapsedMs });
        expect.unreachable("expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(ContactRejectionError);
        expect((error as ContactRejectionError).code).toBe(
          "SUBMITTED_TOO_FAST",
        );
      }
    }
  });

  it("counts links and rejects messages exceeding maxLinks", () => {
    const threeLinks =
      "Check https://a.example, http://b.example, and www.c.example";
    expect(countMessageLinks(threeLinks)).toBe(3);
    expect(() =>
      createContactMessage({ ...BASE_INPUT, message: threeLinks }),
    ).not.toThrow();

    const fourLinks = `${threeLinks} and https://d.example`;
    expect(countMessageLinks(fourLinks)).toBe(4);

    try {
      createContactMessage({ ...BASE_INPUT, message: fourLinks });
      expect.unreachable("expected link limit rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ContactRejectionError);
      expect((error as ContactRejectionError).code).toBe("TOO_MANY_LINKS");
    }
  });
});
