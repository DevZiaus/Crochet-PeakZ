import { z } from "zod";
import { Currency } from "../types/index";

/**
 * Zod schema for validating currency codes.
 * Accepts only "BDT" or "USD".
 */
export const currencySchema = z.enum([Currency.BDT, Currency.USD]);
