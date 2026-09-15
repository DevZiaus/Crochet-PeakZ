/**
 * @crochet-peakz/shared
 *
 * Shared types, Zod validation schemas, and constants used across
 * the frontend (apps/web) and backend (apps/api) workspaces.
 */

export { Currency, type CurrencyCode } from "./types/index.js";
export { currencySchema } from "./schemas/index.js";
export {
  CURRENCIES,
  ORDER_STATUSES,
  type OrderStatus,
} from "./constants/index.js";
