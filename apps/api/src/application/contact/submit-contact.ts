import {
  CONTACT_MAX_LINKS,
  CONTACT_MIN_FILL_TIME_MS,
  CONTACT_TOPICS,
  contactSubmissionSchema,
} from "@crochet-peakz/shared";
import { ContactDeliveryError } from "../../domain/contact/contact-email-sender.js";
import {
  createContactMessage,
  type ContactMessage,
} from "../../domain/contact/contact-message.js";
import type { ContactDependencies } from "./dependencies.js";

/**
 * Formats a visitor-facing cooldown message from a retry delay in seconds.
 *
 * @param retryAfterSeconds Seconds remaining before retrying.
 * @returns Human-readable wait message.
 */
export function formatRetryWaitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Please wait about ${String(minutes)} ${
    minutes === 1 ? "minute" : "minutes"
  } before sending another message.`;
}

/** Error raised when a contact submission exceeds the per-client rate limit. */
export class ContactRateLimitError extends Error {
  /** Stable machine-readable error code. */
  public readonly code = "RATE_LIMITED" as const;

  /**
   * @param retryAfterSeconds Seconds until the caller may retry.
   */
  constructor(public readonly retryAfterSeconds: number) {
    super(formatRetryWaitMessage(retryAfterSeconds));
    this.name = "ContactRateLimitError";
  }
}

/** Input accepted by {@link submitContact}. */
export interface SubmitContactInput {
  /** Untrusted request body. */
  rawInput: unknown;
  /** Rate-limit bucket identifier for the caller. */
  clientKey: string;
}

/**
 * Validates raw contact input against the shared schema and domain anti-spam rules.
 *
 * Kept separate from delivery so transport/presentation layers can validate user
 * input before consuming a rate-limit slot.
 *
 * @param rawInput Untrusted request body.
 * @param now Current timestamp from the application clock.
 * @returns Validated {@link ContactMessage}.
 */
export function validateContactSubmission(
  rawInput: unknown,
  now: Date,
): ContactMessage {
  const parsed = contactSubmissionSchema.parse(rawInput);

  return createContactMessage({
    name: parsed.name,
    email: parsed.email,
    topic: parsed.topic,
    topicLabel: CONTACT_TOPICS[parsed.topic],
    message: parsed.message,
    website: parsed.website,
    elapsedMs: parsed.elapsedMs,
    minFillTimeMs: CONTACT_MIN_FILL_TIME_MS,
    maxLinks: CONTACT_MAX_LINKS,
    submittedAt: now,
  });
}

/**
 * Validates, rate-limits, and delivers a customer contact form submission.
 *
 * Validation runs before consuming a rate-limit slot so malformed payloads do
 * not burn legitimate retry budget, and delivery failures release only the
 * slot consumed by this request.
 *
 * @param dependencies Contact use-case ports.
 * @param input Raw submission payload and caller bucket key.
 * @throws {ContactRateLimitError} When the caller has exhausted their window.
 * @throws {ContactDeliveryError} When outbound email delivery fails.
 */
export async function submitContact(
  dependencies: ContactDependencies,
  input: SubmitContactInput,
): Promise<void> {
  const message = validateContactSubmission(
    input.rawInput,
    dependencies.clock.now(),
  );
  const slot = dependencies.rateLimiter?.consume(input.clientKey);

  if (slot && !slot.allowed) {
    throw new ContactRateLimitError(slot.retryAfterSeconds);
  }

  try {
    await dependencies.emails.sendContactMessage(message);
  } catch (error) {
    slot?.release();
    if (error instanceof ContactDeliveryError) {
      throw error;
    }
    throw new ContactDeliveryError(
      error instanceof Error ? error.message : "Contact email delivery failed.",
    );
  }
}
