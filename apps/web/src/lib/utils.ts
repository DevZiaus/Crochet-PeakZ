import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves conflicting Tailwind utilities.
 * @param inputs - Class values to merge, in priority order (later wins).
 * @returns A single class string with Tailwind conflicts removed.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
