"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CurrencyCode } from "@crochet-peakz/shared";
import { withoutPriceFilters } from "@/lib/catalog/search-params";
import { setCurrency } from "@/lib/currency/actions";
import {
  CURRENCY_SWITCH_ERROR_MESSAGE,
  currencyLabels,
} from "@/lib/currency/labels";

/** Context value shared across storefront currency controls and consumers. */
export interface CurrencyContextValue {
  /** Active currency read from the server cookie (`BDT` or `USD`). */
  readonly currency: CurrencyCode;
  /** Currency being switched to while a transition is in flight, or `null`. */
  readonly pendingCurrency: CurrencyCode | null;
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
 * Provides the active server currency, transition state, polite live region,
 * and switch handler to storefront client components (AC-1, AC-3, AC-5, AC-7,
 * AC-8, AC-9).
 */
export function CurrencyProvider({
  currency,
  children,
}: CurrencyProviderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingCurrency, setPendingCurrency] =
    useOptimistic<CurrencyCode | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [restoreTick, setRestoreTick] = useState(0);
  const pendingFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isPending && pendingFocusRef.current !== null) {
      const target = pendingFocusRef.current;
      pendingFocusRef.current = null;
      if (target.isConnected) {
        target.focus();
      }
    }
  }, [isPending, restoreTick]);

  const switchCurrency = useCallback(
    (nextCurrency: CurrencyCode, focusTarget?: HTMLElement | null): void => {
      if (nextCurrency === currency || isPending) {
        return;
      }

      const cleaned = withoutPriceFilters(
        window.location.pathname,
        new URLSearchParams(window.location.search),
      );

      startTransition(async () => {
        setPendingCurrency(nextCurrency);
        try {
          const result = await setCurrency({ currency: nextCurrency });
          if (!result.ok) {
            toast.error(CURRENCY_SWITCH_ERROR_MESSAGE);
            console.error("Failed to switch currency:", result.error);
            return;
          }

          setAnnouncement(currencyLabels[nextCurrency].announcement);
          if (cleaned !== null) {
            router.replace(cleaned);
          }
        } catch (error) {
          toast.error(CURRENCY_SWITCH_ERROR_MESSAGE);
          console.error("Failed to switch currency:", error);
        } finally {
          pendingFocusRef.current = focusTarget ?? null;
          setRestoreTick((tick) => tick + 1);
        }
      });
    },
    [currency, isPending, router, setPendingCurrency],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        pendingCurrency,
        isPending,
        announcement,
        switchCurrency,
      }}
    >
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
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
