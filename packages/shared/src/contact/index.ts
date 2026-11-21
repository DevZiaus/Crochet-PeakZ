import { z } from "zod";

/** Default public contact email address for Crochet PeakZ. */
export const DEFAULT_CONTACT_EMAIL = "hello@crochetpeakz.tech";

/** Ordered keys for supported contact form topics. */
export const CONTACT_TOPIC_KEYS = [
  "general",
  "custom-order",
  "order",
  "patterns",
  "privacy",
  "data-deletion",
] as const;

/** Human-readable labels for each contact form topic. */
export const CONTACT_TOPICS = {
  general: "General inquiry",
  "custom-order": "Custom order & commission",
  order: "Order & shipping help",
  patterns: "Patterns & digital guides",
  privacy: "Privacy & data request",
  "data-deletion": "Data deletion",
} as const satisfies Record<(typeof CONTACT_TOPIC_KEYS)[number], string>;

/** Supported contact topic identifier. */
export type ContactTopic = keyof typeof CONTACT_TOPICS;

/** Minimum accepted length for a contact sender's name. */
export const CONTACT_NAME_MIN = 1;
/** Maximum accepted length for a contact sender's name. */
export const CONTACT_NAME_MAX = 100;
/** Maximum accepted length for a contact sender's email address. */
export const CONTACT_EMAIL_MAX = 254;
/** Minimum accepted length for a contact message body. */
export const CONTACT_MESSAGE_MIN = 5;
/** Maximum accepted length for a contact message body. */
export const CONTACT_MESSAGE_MAX = 5000;
/** Minimum elapsed milliseconds between page load and submission. */
export const CONTACT_MIN_FILL_TIME_MS = 3000;
/** Maximum number of URLs allowed in a single contact message. */
export const CONTACT_MAX_LINKS = 3;
/** Maximum accepted JSON request body size in bytes for contact submissions. */
export const CONTACT_MAX_BODY_BYTES = 20_000;

const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Type guard checking whether a string is a recognized contact topic key.
 *
 * @param value Raw topic string.
 * @returns True when `value` matches one of {@link CONTACT_TOPIC_KEYS}.
 */
export function isContactTopic(value: string): value is ContactTopic {
  return Object.prototype.hasOwnProperty.call(CONTACT_TOPICS, value);
}

/** Shared validation schema for contact form submissions. */
export const contactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(CONTACT_NAME_MIN, "Please enter your name.")
    .max(
      CONTACT_NAME_MAX,
      `Name must be ${String(CONTACT_NAME_MAX)} characters or fewer.`,
    ),
  email: z
    .string()
    .trim()
    .max(CONTACT_EMAIL_MAX, "Please enter a valid email address.")
    .regex(CONTACT_EMAIL_PATTERN, "Please enter a valid email address."),
  topic: z.enum(CONTACT_TOPIC_KEYS, "Please choose a topic."),
  message: z
    .string()
    .trim()
    .min(
      CONTACT_MESSAGE_MIN,
      `Please write a message between ${String(CONTACT_MESSAGE_MIN)} and ${String(CONTACT_MESSAGE_MAX)} characters.`,
    )
    .max(
      CONTACT_MESSAGE_MAX,
      `Please write a message between ${String(CONTACT_MESSAGE_MIN)} and ${String(CONTACT_MESSAGE_MAX)} characters.`,
    ),
  website: z.string().default(""),
  elapsedMs: z.number().default(0),
});

/** Validated contact submission payload. */
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
