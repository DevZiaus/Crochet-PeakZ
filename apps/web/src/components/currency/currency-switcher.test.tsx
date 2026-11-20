/**
 * Component tests for `CurrencyProvider`, `CurrencySwitcher`, and
 * `CurrencyRadio` (AC-1, AC-2, AC-3, AC-5, AC-7, AC-8, AC-9).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Currency } from "@crochet-peakz/shared";
import type { SetCurrencyResult } from "../../lib/currency/actions";
import {
  CurrencyProvider,
  useCurrency,
  useCurrencySwitch,
  useOptionalCurrency,
} from "./currency-provider";
import { CurrencyRadio } from "./currency-radio";
import { CurrencySwitcher } from "./currency-switcher";

const { replaceMock, setCurrencyMock, toastErrorMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  setCurrencyMock: vi.fn<
    (input: { currency: string }) => Promise<SetCurrencyResult>
  >(() => Promise.resolve({ ok: true as const })),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: replaceMock,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("../../lib/currency/actions", () => ({
  setCurrency: setCurrencyMock,
}));

function setLocation(pathname: string, search = ""): void {
  window.history.replaceState({}, "", `${pathname}${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  setCurrencyMock.mockResolvedValue({ ok: true });
  setLocation("/");
});

describe("CurrencyProvider hooks", () => {
  it("throws when useCurrency or useCurrencySwitch is called outside CurrencyProvider (AC-9)", () => {
    expect(() => renderHook(() => useCurrency())).toThrow(
      "useCurrency must be used within a CurrencyProvider",
    );
    expect(() => renderHook(() => useCurrencySwitch())).toThrow(
      "useCurrencySwitch must be used within a CurrencyProvider",
    );
  });

  it("returns null from useOptionalCurrency outside CurrencyProvider and the active currency inside (AC-1, AC-9)", () => {
    const outside = renderHook(() => useOptionalCurrency());
    expect(outside.result.current).toBeNull();

    const inside = renderHook(() => useOptionalCurrency(), {
      wrapper: ({ children }) => (
        <CurrencyProvider currency={Currency.USD}>{children}</CurrencyProvider>
      ),
    });
    expect(inside.result.current).toBe(Currency.USD);
  });
});

describe("CurrencySwitcher", () => {
  it("renders the active currency trigger and lists both options as radio items (AC-1)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });
    expect(trigger).toHaveTextContent("৳ BDT");

    await user.click(trigger);

    const bdtOption = await screen.findByRole("menuitemradio", {
      name: "৳ BDT, Bangladeshi taka",
    });
    const usdOption = screen.getByRole("menuitemradio", {
      name: "$ USD, US dollars",
    });

    expect(bdtOption).toHaveAttribute("aria-checked", "true");
    expect(usdOption).toHaveAttribute("aria-checked", "false");
  });

  it("closes the menu and sends no request when choosing the already active currency (AC-3)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Currency: ৳ BDT" }));
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: "৳ BDT, Bangladeshi taka",
      }),
    );

    expect(setCurrencyMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("calls setCurrency, announces the change, and restores focus to the trigger once enabled (AC-2, AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });
    await user.click(trigger);
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: "$ USD, US dollars",
      }),
    );

    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Prices now shown in US dollars",
      );
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveFocus();
    });

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("replaces the /shop URL with price filters and page removed on a switch (AC-5)", async () => {
    setLocation(
      "/shop",
      "?category=bags&minPrice=500&maxPrice=2000&page=2&sort=price-asc",
    );
    const user = userEvent.setup();

    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Currency: ৳ BDT" }));
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: "$ USD, US dollars",
      }),
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/shop?category=bags&sort=price-asc",
      );
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("disables the trigger with aria-busy while pending and shows an error toast on failure (AC-7)", async () => {
    let rejectAction: (reason?: unknown) => void = () => undefined;
    setCurrencyMock.mockImplementation(
      () =>
        new Promise<SetCurrencyResult>((_resolve, reject) => {
          rejectAction = reject;
        }),
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const user = userEvent.setup();
      render(
        <CurrencyProvider currency={Currency.BDT}>
          <CurrencySwitcher />
        </CurrencyProvider>,
      );

      const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });
      await user.click(trigger);
      await user.click(
        await screen.findByRole("menuitemradio", {
          name: "$ USD, US dollars",
        }),
      );

      await waitFor(() => {
        expect(trigger).toBeDisabled();
        expect(trigger).toHaveAttribute("aria-busy", "true");
      });

      rejectAction(new Error("network down"));

      await waitFor(() => {
        expect(trigger).toBeEnabled();
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Could not change currency, please try again",
        );
      });

      expect(trigger).toHaveTextContent("৳ BDT");
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("shows an error toast and keeps the old currency when setCurrency returns ok: false (AC-7)", async () => {
    setCurrencyMock.mockResolvedValue({
      ok: false,
      error: "INVALID_CURRENCY",
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const user = userEvent.setup();
      render(
        <CurrencyProvider currency={Currency.BDT}>
          <CurrencySwitcher />
        </CurrencyProvider>,
      );

      await user.click(screen.getByRole("button", { name: "Currency: ৳ BDT" }));
      await user.click(
        await screen.findByRole("menuitemradio", {
          name: "$ USD, US dollars",
        }),
      );

      await waitFor(() => {
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Could not change currency, please try again",
        );
      });
      expect(replaceMock).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("CurrencyRadio", () => {
  it("renders a Currency fieldset with two radio options, switches on change, announces, and restores focus (AC-1, AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencyRadio />
      </CurrencyProvider>,
    );

    const group = screen.getByRole("group", { name: "Currency" });
    expect(group).toBeInTheDocument();

    const bdtRadio = screen.getByRole("radio", {
      name: "৳ BDT, Bangladeshi taka",
    });
    const usdRadio = screen.getByRole("radio", {
      name: "$ USD, US dollars",
    });

    expect(bdtRadio).toBeChecked();
    expect(usdRadio).not.toBeChecked();

    await user.click(usdRadio);

    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
    });

    await waitFor(() => {
      const liveRegions = screen.getAllByRole("status");
      expect(
        liveRegions.some(
          (region) => region.textContent === "Prices now shown in US dollars",
        ),
      ).toBe(true);
      expect(usdRadio).toBeEnabled();
      expect(usdRadio).toHaveFocus();
    });
  });
});
