"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { CurrencyCode } from "@crochet-peakz/shared";
import { setCurrency } from "@/lib/currency/actions";

/** Context value shared across storefront currency controls and consumers. */
export interface CurrencyContextValue {
  /** Active currency read from the server cookie (`BDT` or `USD`). */
  readonly currency: CurrencyCode;
  /** Whether a currency switch transition is currently in flight. */
  readonly isPending: boolean;
  /** Latest polite live region announcement after a switch. */
  readonly announcement: string;
  /** Switches the active currency when a different option is chosen. */
  readonly switchCurrency: (
    nextCurrency: CurrencyCode,
    focusTarget?: HTMLElement | null,
  ) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/** Props for `CurrencyProvider`. */
export interface CurrencyProviderProps {
  /** Active currency read on the server by `getActiveCurrency()`. */
  currency: CurrencyCode;
  /** Storefront subtree. */
  children: ReactNode;
}

/**
 * Provides the active server currency and switch action to storefront client
 * components (AC-1, AC-9).
 */
export function CurrencyProvider({
  currency,
  children,
}: CurrencyProviderProps) {
  const switchCurrency = useCallback(
    (nextCurrency: CurrencyCode): void => {
      if (nextCurrency === currency) {
        return;
      }

      void setCurrency({ currency: nextCurrency });
    },
    [currency],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        isPending: false,
        announcement: "",
        switchCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Reads the active currency inside a storefront `CurrencyProvider`.
 *
 * Throws if called outside the provider so missing wiring fails loudly (AC-9).
 *
 * @returns The active currency (`BDT` or `USD`).
 */
export function useCurrency(): CurrencyCode {
  const context = useContext(CurrencyContext);
  if (context === null) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context.currency;
}

/**
 * Reads the active currency when a `CurrencyProvider` is mounted, or `null`
 * outside the storefront (such as auth and admin layouts, AC-1).
 *
 * @returns The active currency or `null`.
 */
export function useOptionalCurrency(): CurrencyCode | null {
  const context = useContext(CurrencyContext);
  return context?.currency ?? null;
}

/**
 * Reads the full currency switch state and handler inside a
 * `CurrencyProvider`.
 *
 * @returns Active currency, pending flag, live announcement, and switch handler.
 */
export function useCurrencySwitch(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (context === null) {
    throw new Error("useCurrencySwitch must be used within a CurrencyProvider");
  }
  return context;
}
