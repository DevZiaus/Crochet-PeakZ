import {
  CONTACT_MAX_LINKS,
  CONTACT_MIN_FILL_TIME_MS,
  CONTACT_TOPICS,
  contactSubmissionSchema,
} from "@crochet-peakz/shared";
import {
  createContactMessage,
  type ContactMessage,
} from "../../domain/contact/contact-message.js";
import type { ContactDependencies } from "./dependencies.js";

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
 * Validates and delivers a customer contact form submission.
 *
 * @param dependencies Contact use-case ports.
 * @param rawInput Untrusted submission payload.
 */
export async function submitContact(
  dependencies: ContactDependencies,
  rawInput: unknown,
): Promise<void> {
  const message = validateContactSubmission(rawInput, dependencies.clock.now());
  await dependencies.emails.sendContactMessage(message);
}
