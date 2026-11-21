/**
 * Component tests for `CurrencyProvider`, `CurrencySwitcher`, and
 * `CurrencyRadio` (AC-1, AC-2, AC-3, AC-5, AC-7, AC-8, AC-9).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("returns the active currency from useCurrency inside CurrencyProvider (AC-9)", () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: ({ children }) => (
        <CurrencyProvider currency={Currency.BDT}>{children}</CurrencyProvider>
      ),
    });
    expect(result.current).toBe(Currency.BDT);
  });

  it("ignores duplicate switchCurrency calls while a switch is already in flight (AC-3, AC-7)", async () => {
    let resolveAction: (value: SetCurrencyResult) => void = () => undefined;
    setCurrencyMock.mockImplementation(
      () =>
        new Promise<SetCurrencyResult>((resolve) => {
          resolveAction = resolve;
        }),
    );

    function DuplicateSwitchHarness() {
      const { isPending, switchCurrency } = useCurrencySwitch();
      return (
        <button
          type="button"
          data-pending={String(isPending)}
          onClick={() => {
            switchCurrency(Currency.USD);
          }}
        >
          Trigger switch
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <DuplicateSwitchHarness />
      </CurrencyProvider>,
    );

    const button = screen.getByRole("button", { name: "Trigger switch" });
    await user.click(button);

    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledTimes(1);
      expect(button).toHaveAttribute("data-pending", "true");
    });

    await user.click(button);
    expect(setCurrencyMock).toHaveBeenCalledTimes(1);

    resolveAction({ ok: true });
    await waitFor(() => {
      expect(button).toHaveAttribute("data-pending", "false");
    });
    expect(setCurrencyMock).toHaveBeenCalledTimes(1);
  });

  it("renders a polite atomic status region that stays empty when a switch fails (AC-7, AC-8)", async () => {
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

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveAttribute("aria-atomic", "true");
      expect(status).toHaveTextContent("");

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
      expect(status).toHaveTextContent("");
    } finally {
      consoleError.mockRestore();
    }
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

  it("keeps sibling focusable controls visible to assistive tech while open and toggles or closes on Escape (AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <button type="button">Outside action</button>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    const outsideControl = screen.getByRole("button", {
      name: "Outside action",
    });
    const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });

    await user.click(trigger);
    await screen.findByRole("menuitemradio", { name: "$ USD, US dollars" });

    expect(
      document.querySelectorAll(
        '[aria-hidden="true"] button, button[aria-hidden="true"]',
      ),
    ).toHaveLength(0);
    expect(outsideControl.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole("menu")).not.toHaveClass(
      "data-[state=closed]:animate-out",
    );

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });

    await user.click(trigger);
    await screen.findByRole("menuitemradio", { name: "$ USD, US dollars" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("renders USD as active with a check indicator on the active option and announces switching back to BDT (AC-1, AC-2, AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.USD}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Currency: $ USD" });
    expect(trigger).toHaveTextContent("$ USD");

    await user.click(trigger);

    const bdtOption = await screen.findByRole("menuitemradio", {
      name: "৳ BDT, Bangladeshi taka",
    });
    const usdOption = screen.getByRole("menuitemradio", {
      name: "$ USD, US dollars",
    });

    expect(usdOption).toHaveAttribute("aria-checked", "true");
    expect(usdOption.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(bdtOption).toHaveAttribute("aria-checked", "false");
    expect(bdtOption.querySelector('svg[aria-hidden="true"]')).toBeNull();

    await user.click(bdtOption);

    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "BDT" });
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Prices now shown in Bangladeshi taka",
      );
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveFocus();
    });
  });

  it("toggles aria-expanded on the trigger across open and Escape close (AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    await screen.findByRole("menuitemradio", { name: "$ USD, US dollars" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("shows a spinner while pending and restores focus to the trigger after a failed switch (AC-7, AC-8)", async () => {
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
      expect(trigger.querySelector('svg[aria-hidden="true"]')).toBeNull();

      await user.click(trigger);
      await user.click(
        await screen.findByRole("menuitemradio", {
          name: "$ USD, US dollars",
        }),
      );

      await waitFor(() => {
        expect(trigger).toBeDisabled();
        expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      });

      rejectAction(new Error("network down"));

      await waitFor(() => {
        expect(trigger).toBeEnabled();
        expect(trigger).toHaveFocus();
        expect(trigger.querySelector('svg[aria-hidden="true"]')).toBeNull();
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("leaves the URL unchanged when switching without price params on /shop or on a collection route (AC-5)", async () => {
    const user = userEvent.setup();
    setLocation("/shop", "?category=bags&sort=price-asc");

    const { unmount } = render(
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
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
    });
    expect(replaceMock).not.toHaveBeenCalled();

    unmount();
    vi.clearAllMocks();
    setCurrencyMock.mockResolvedValue({ ok: true });
    setLocation("/collections/amigurumi", "?minPrice=10");

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
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("opens with Enter, navigates with ArrowDown, activates with Enter, and restores trigger focus (AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
      </CurrencyProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    const usdOption = await screen.findByRole("menuitemradio", {
      name: "$ USD, US dollars",
    });

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(usdOption).toHaveFocus();
    });

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Prices now shown in US dollars",
      );
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveFocus();
    });
  });

  it("does not show the currency failure toast if router.replace throws after setCurrency succeeds (AC-5, AC-7)", async () => {
    setLocation("/shop", "?category=bags&minPrice=500");
    replaceMock.mockImplementationOnce(() => {
      throw new Error("navigation aborted");
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

      const trigger = screen.getByRole("button", { name: "Currency: ৳ BDT" });
      await user.click(trigger);
      await user.click(
        await screen.findByRole("menuitemradio", {
          name: "$ USD, US dollars",
        }),
      );

      await waitFor(() => {
        expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
        expect(screen.getByRole("status")).toHaveTextContent(
          "Prices now shown in US dollars",
        );
        expect(trigger).toBeEnabled();
        expect(trigger).toHaveFocus();
      });

      expect(toastErrorMock).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to reset shop price filters:",
        expect.any(Error),
      );
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

  it("checks the clicked radio immediately while pending and reverts to the active currency on failure (AC-7)", async () => {
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
          <CurrencyRadio />
        </CurrencyProvider>,
      );

      const group = screen.getByRole("group", { name: "Currency" });
      const bdtRadio = screen.getByRole("radio", {
        name: "৳ BDT, Bangladeshi taka",
      });
      const usdRadio = screen.getByRole("radio", {
        name: "$ USD, US dollars",
      });

      await user.click(usdRadio);

      await waitFor(() => {
        expect(usdRadio).toBeChecked();
        expect(bdtRadio).not.toBeChecked();
        expect(group).toBeDisabled();
        expect(group).toHaveAttribute("aria-busy", "true");
      });

      rejectAction(new Error("network down"));

      await waitFor(() => {
        expect(group).toBeEnabled();
        expect(usdRadio).not.toBeChecked();
        expect(bdtRadio).toBeChecked();
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Could not change currency, please try again",
        );
      });

      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("renders USD checked, switches back to BDT, announces inside the drawer live region, and restores radio focus (AC-1, AC-2, AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.USD}>
        <CurrencyRadio />
      </CurrencyProvider>,
    );

    const group = screen.getByRole("group", { name: "Currency" });
    const bdtRadio = within(group).getByRole("radio", {
      name: "৳ BDT, Bangladeshi taka",
    });
    const usdRadio = within(group).getByRole("radio", {
      name: "$ USD, US dollars",
    });

    expect(usdRadio).toBeChecked();
    expect(bdtRadio).not.toBeChecked();

    await user.click(bdtRadio);

    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "BDT" });
    });
    await waitFor(() => {
      const drawerStatus = within(group).getByRole("status");
      expect(drawerStatus).toHaveAttribute("aria-live", "polite");
      expect(drawerStatus).toHaveAttribute("aria-atomic", "true");
      expect(drawerStatus).toHaveTextContent(
        "Prices now shown in Bangladeshi taka",
      );
      expect(bdtRadio).toBeEnabled();
      expect(bdtRadio).toHaveFocus();
    });
  });

  it("sends no request when clicking the already active radio option (AC-3)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencyRadio />
      </CurrencyProvider>,
    );

    await user.click(
      screen.getByRole("radio", { name: "৳ BDT, Bangladeshi taka" }),
    );

    expect(setCurrencyMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("replaces /shop price filters and page when switching from the mobile radio (AC-5)", async () => {
    setLocation("/shop", "?category=bags&minPrice=500&page=2");
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencyRadio />
      </CurrencyProvider>,
    );

    await user.click(screen.getByRole("radio", { name: "$ USD, US dollars" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/shop?category=bags");
    });
  });

  it("shows a spinner in the fieldset legend while pending and hides it when settled (AC-7)", async () => {
    let resolveAction: (value: SetCurrencyResult) => void = () => undefined;
    setCurrencyMock.mockImplementation(
      () =>
        new Promise<SetCurrencyResult>((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencyRadio />
      </CurrencyProvider>,
    );

    const group = screen.getByRole("group", { name: "Currency" });
    expect(group.querySelector('legend svg[aria-hidden="true"]')).toBeNull();

    await user.click(screen.getByRole("radio", { name: "$ USD, US dollars" }));

    await waitFor(() => {
      expect(group).toBeDisabled();
      expect(
        group.querySelector('legend svg[aria-hidden="true"]'),
      ).not.toBeNull();
    });

    resolveAction({ ok: true });

    await waitFor(() => {
      expect(group).toBeEnabled();
      expect(group.querySelector('legend svg[aria-hidden="true"]')).toBeNull();
    });
  });

  it("reverts to BDT, shows an error toast, and skips replace or announcement when setCurrency returns ok: false (AC-7)", async () => {
    setLocation("/shop", "?category=bags&minPrice=500");
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
          <CurrencyRadio />
        </CurrencyProvider>,
      );

      const group = screen.getByRole("group", { name: "Currency" });
      const bdtRadio = within(group).getByRole("radio", {
        name: "৳ BDT, Bangladeshi taka",
      });
      const usdRadio = within(group).getByRole("radio", {
        name: "$ USD, US dollars",
      });

      await user.click(usdRadio);

      await waitFor(() => {
        expect(toastErrorMock).toHaveBeenCalledWith(
          "Could not change currency, please try again",
        );
      });
      expect(bdtRadio).toBeChecked();
      expect(usdRadio).not.toBeChecked();
      expect(replaceMock).not.toHaveBeenCalled();
      expect(within(group).getByRole("status")).toHaveTextContent("");
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("announces only in the drawer live region on drawer switch and only in the provider live region on header switch (AC-8)", async () => {
    const user = userEvent.setup();
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <CurrencySwitcher />
        <CurrencyRadio />
      </CurrencyProvider>,
    );

    const group = screen.getByRole("group", { name: "Currency" });
    const drawerStatus = within(group).getByRole("status");
    const providerStatus = screen
      .getAllByRole("status")
      .find((region) => region !== drawerStatus);
    if (!providerStatus) {
      throw new Error("provider status live region missing");
    }

    await user.click(
      within(group).getByRole("radio", { name: "$ USD, US dollars" }),
    );

    await waitFor(() => {
      expect(drawerStatus).toHaveTextContent("Prices now shown in US dollars");
    });
    expect(providerStatus).toHaveTextContent("");

    await user.click(screen.getByRole("button", { name: "Currency: ৳ BDT" }));
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: "$ USD, US dollars",
      }),
    );

    await waitFor(() => {
      expect(providerStatus).toHaveTextContent(
        "Prices now shown in US dollars",
      );
    });
    expect(drawerStatus).toHaveTextContent("");
  });
});
