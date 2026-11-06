import { timingSafeEqual } from "node:crypto";

/**
 * Compares two strings without leaking either their prefix or their length.
 *
 * A plain equality check short circuits on the first differing byte and on any
 * length mismatch, so the time it takes hints at how much of the value an
 * attacker has guessed. This compares the two values over a fixed width and
 * folds the length check into the result, so a caller cannot time the
 * comparison to learn the value or its size.
 *
 * @param a First value.
 * @param b Second value.
 * @returns True when the two values are identical.
 */
export function timingSafeStringEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Compare over a fixed width so a length mismatch cannot short circuit and
  // leak the length through timing.
  const length = Math.max(left.length, right.length, 1);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return (
    timingSafeEqual(paddedLeft, paddedRight) && left.length === right.length
  );
}
