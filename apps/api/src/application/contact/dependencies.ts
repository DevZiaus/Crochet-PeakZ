import type { ContactEmailSender } from "../../domain/contact/contact-email-sender.js";
import type { Clock } from "../../domain/ports/clock.js";

/** Dependencies required by the contact submission use cases. */
export interface ContactDependencies {
  /** Outbound contact email port. */
  emails: ContactEmailSender;
  /** Clock used to timestamp accepted contact messages. */
  clock: Clock;
}
