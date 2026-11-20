/** Reasons a contact form submission is rejected by anti-spam rules. */
export type ContactRejectionCode =
  "HONEYPOT_FILLED" | "SUBMITTED_TOO_FAST" | "TOO_MANY_LINKS";

/** Error raised when a contact submission trips a domain anti-spam invariant. */
export class ContactRejectionError extends Error {
  /**
   * @param code Machine-readable rejection code.
   * @param message Human-readable rejection explanation safe for the visitor.
   */
  constructor(
    public readonly code: ContactRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = "ContactRejectionError";
  }
}

/** Validated contact message ready for delivery. */
export interface ContactMessage {
  /** Sender display name. */
  name: string;
  /** Sender reply-to email address. */
  email: string;
  /** Topic key. */
  topic: string;
  /** Human-readable topic label. */
  topicLabel: string;
  /** Message body text. */
  message: string;
  /** Timestamp when the submission was accepted. */
  submittedAt: Date;
}

/** Inputs required to construct and validate a {@link ContactMessage}. */
export interface CreateContactMessageInput {
  /** Sanitized sender name. */
  name: string;
  /** Sanitized sender email address. */
  email: string;
  /** Topic key. */
  topic: string;
  /** Human-readable topic label. */
  topicLabel: string;
  /** Sanitized message body. */
  message: string;
  /** Honeypot field value (must be empty). */
  website: string;
  /** Elapsed milliseconds since the form loaded. */
  elapsedMs: number;
  /** Minimum elapsed milliseconds required before accepting submission. */
  minFillTimeMs: number;
  /** Maximum number of URLs allowed inside the message body. */
  maxLinks: number;
  /** Acceptance timestamp. */
  submittedAt: Date;
}

/**
 * Counts HTTP/HTTPS and `www.` links appearing in a contact message.
 *
 * @param message Raw message body.
 * @returns Number of URL occurrences.
 */
export function countMessageLinks(message: string): number {
  return message.match(/(?:https?:\/\/|www\.)/gi)?.length ?? 0;
}

/**
 * Enforces contact anti-spam invariants and produces a {@link ContactMessage}.
 *
 * @param input Normalized submission fields and policy thresholds.
 * @returns Validated {@link ContactMessage}.
 * @throws {ContactRejectionError} When honeypot, minimum fill time, or link limit fails.
 */
export function createContactMessage(
  input: CreateContactMessageInput,
): ContactMessage {
  if (input.website.length > 0) {
    throw new ContactRejectionError(
      "HONEYPOT_FILLED",
      "Your message was flagged as spam.",
    );
  }

  if (
    !Number.isFinite(input.elapsedMs) ||
    input.elapsedMs < input.minFillTimeMs
  ) {
    throw new ContactRejectionError(
      "SUBMITTED_TOO_FAST",
      "Please take a moment and try again.",
    );
  }

  if (countMessageLinks(input.message) > input.maxLinks) {
    throw new ContactRejectionError(
      "TOO_MANY_LINKS",
      "Your message was flagged as spam.",
    );
  }

  return {
    name: input.name,
    email: input.email,
    topic: input.topic,
    topicLabel: input.topicLabel,
    message: input.message,
    submittedAt: input.submittedAt,
  };
}
