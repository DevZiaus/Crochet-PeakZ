/**
 * Clock port, so lifetimes and locks are testable without waiting.
 */
export interface Clock {
  /** Returns the current time. */
  now(): Date;
}

/** Default clock backed by the system time. */
export const systemClock: Clock = {
  now: () => new Date(),
};
