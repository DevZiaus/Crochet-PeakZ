import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import {
  Currency,
  ProductType,
  type AuthUser,
  type CartLineDto,
  type CurrencyCode,
} from "@crochet-peakz/shared";
import type { SetCurrencyResult } from "../../lib/currency/actions";
import { CurrencyProvider } from "../currency/currency-provider";
import { SessionProvider } from "../auth/session-provider";
import { CartProvider } from "./cart-provider";
import { CartDrawer } from "./cart-drawer";
import { CartPageContent } from "./cart-page-content";
import { Header } from "../header";
import { PurchasePanel } from "../catalog/purchase-panel";
import {
  GUEST_CART_STORAGE_KEY,
  createEmptyGuestCart,
  useGuestCartStore,
} from "../../lib/cart/guest-cart-store";
import {
  makeProductDetail,
  makeVariant,
} from "../../test-support/catalog-fixtures";

const { toastErrorMock, setCurrencyMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  setCurrencyMock: vi.fn<
    (input: { currency: string }) => Promise<SetCurrencyResult>
  >(() => Promise.resolve({ ok: true as const })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}));

vi.mock("../../lib/currency/actions", () => ({
  setCurrency: setCurrencyMock,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const PRODUCT_ID = "0194f3e0-1234-7abc-8def-012345678901";
const VARIANT_ID_A = "550e8400-e29b-41d4-a716-446655440001";
const VARIANT_ID_OOAK = "550e8400-e29b-41d4-a716-446655440002";
const VARIANT_ID_DEAD = "550e8400-e29b-41d4-a716-446655440003";

const CUSTOMER: AuthUser = {
  id: "0194f3e0-9999-7abc-8def-012345678999",
  name: "Nadia Rahman",
  email: "nadia@example.com",
  role: "CUSTOMER",
  avatarUrl: null,
  emailVerified: true,
};

function makeCartLine(overrides: Partial<CartLineDto> = {}): CartLineDto {
  return {
    productId: PRODUCT_ID,
    variantId: VARIANT_ID_A,
    slug: "sunflower-bear",
    title: "Sunflower Amigurumi Bear",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/bear",
    imageAlt: "A crocheted bear",
    variantLabel: "Honey Gold",
    productType: ProductType.STANDARD,
    unitPriceBdt: 1800,
    unitPriceUsd: 22,
    quantity: 1,
    maxQuantity: 5,
    status: "OK",
    addedAt: "2026-11-27T10:00:00.000Z",
    ...overrides,
  };
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderWithStorefront(
  ui: React.ReactNode,
  currency: CurrencyCode = Currency.BDT,
) {
  return render(
    <SessionProvider>
      <CurrencyProvider currency={currency}>
        <CartProvider>
          <Header />
          {ui}
          <CartDrawer />
        </CartProvider>
      </CurrencyProvider>
    </SessionProvider>,
  );
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/");
  window.localStorage.clear();
  useGuestCartStore.setState(createEmptyGuestCart());
  toastErrorMock.mockClear();
  setCurrencyMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Shopping cart UI and provider integration", () => {
  it("adds a variant from PurchasePanel, updates header badge, opens drawer, announces, and switches currency without refetch", async () => {
    const user = userEvent.setup();
    let quoteCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/api/auth/me") {
          return Promise.resolve(
            jsonResponse({ error: { message: "No" } }, 401),
          );
        }
        if (url === "/api/cart/quote") {
          quoteCount += 1;
          return Promise.resolve(
            jsonResponse({ data: { lines: [makeCartLine({ quantity: 1 })] } }),
          );
        }
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );

    const product = makeProductDetail({
      id: PRODUCT_ID,
      title: "Sunflower Amigurumi Bear",
      variants: [
        makeVariant({
          id: VARIANT_ID_A,
          colorName: "Honey Gold",
          stockQuantity: 5,
        }),
      ],
    });

    renderWithStorefront(<PurchasePanel product={product} currency="BDT" />);

    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    const drawer = await screen.findByRole("dialog", { name: "Shopping cart" });
    expect(
      within(drawer).getByRole("link", { name: "Sunflower Amigurumi Bear" }),
    ).toHaveAttribute("href", "/shop/sunflower-bear");
    expect(within(drawer).getAllByText("৳1,800")).toHaveLength(2);
    expect(within(drawer).getByRole("status")).toHaveTextContent(
      "Added Sunflower Amigurumi Bear to your cart",
    );

    const quotesBeforeSwitch = quoteCount;

    // Close drawer with Escape and confirm header badge shows 1 item.
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Shopping cart" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Shopping cart, 1 item" }),
    ).toBeInTheDocument();

    // Switch currency in header to USD; prices update without another quote call.
    await user.click(screen.getByRole("button", { name: "Currency: ৳ BDT" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /USD/ }));
    await waitFor(() => {
      expect(setCurrencyMock).toHaveBeenCalledWith({ currency: "USD" });
    });

    // Quote count stayed identical on currency switch.
    expect(quoteCount).toBe(quotesBeforeSwitch);
  });

  it("shows lowered notices across revalidations, renders unavailable fallbacks and OOAK Qty 1, and guards Clear cart with confirm dialog", async () => {
    const user = userEvent.setup();
    let quoteCall = 0;

    useGuestCartStore.setState({
      guestCartId: "550e8400-e29b-41d4-a716-446655440099",
      updatedAt: new Date().toISOString(),
      lines: [
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID_A,
          quantity: 4,
          addedAt: "2026-11-27T10:02:00.000Z",
        },
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID_OOAK,
          quantity: 1,
          addedAt: "2026-11-27T10:01:00.000Z",
        },
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID_DEAD,
          quantity: 1,
          addedAt: "2026-11-27T10:00:00.000Z",
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/api/auth/me") {
          return Promise.resolve(jsonResponse({}, 401));
        }
        if (url === "/api/cart/quote") {
          quoteCall += 1;
          return Promise.resolve(
            jsonResponse({
              data: {
                lines: [
                  // First call reports LOWERED; second call reports OK for qty 2,
                  // yet CartProvider must retain the lowered notice in memory!
                  makeCartLine({
                    variantId: VARIANT_ID_A,
                    quantity: 2,
                    maxQuantity: 2,
                    status: quoteCall === 1 ? "LOWERED" : "OK",
                  }),
                  makeCartLine({
                    variantId: VARIANT_ID_OOAK,
                    title: "Vintage Lace Doily",
                    slug: "vintage-lace-doily",
                    productType: ProductType.ONE_OF_A_KIND,
                    unitPriceBdt: 3500,
                    unitPriceUsd: 42,
                    quantity: 1,
                    maxQuantity: 1,
                    status: "OK",
                  }),
                  makeCartLine({
                    variantId: VARIANT_ID_DEAD,
                    title: null,
                    slug: null,
                    imageUrl: null,
                    imageAlt: null,
                    variantLabel: null,
                    unitPriceBdt: null,
                    unitPriceUsd: null,
                    quantity: 1,
                    maxQuantity: 0,
                    status: "UNAVAILABLE",
                  }),
                ],
              },
            }),
          );
        }
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );

    renderWithStorefront(<CartPageContent />);

    expect(
      await screen.findByText("Only 2 left, quantity lowered"),
    ).toBeInTheDocument();
    expect(screen.getByText("Qty 1")).toBeInTheDocument();
    expect(screen.getByText("Unavailable item")).toBeInTheDocument();
    expect(screen.getByText("No longer available")).toBeInTheDocument();
    expect(
      screen.getByText("Remove unavailable items to continue"),
    ).toBeInTheDocument();
    expect(screen.getByText("Checkout is coming soon")).toBeInTheDocument();

    // Accessible item-specific stepper and remove controls (AC-17)
    expect(
      screen.getByRole("button", {
        name: "Increase quantity of Sunflower Amigurumi Bear",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Decrease quantity of Sunflower Amigurumi Bear",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Remove Vintage Lace Doily from cart",
      }),
    ).toBeInTheDocument();

    // Subtotal includes lowered Bear (2 * 1800 = 3600) + Doily (3500) = 7100, excluding unavailable.
    expect(screen.getByText("৳7,100")).toBeInTheDocument();

    // Open Clear cart dialog -> Keep items -> Clear cart -> confirms empty.
    await user.click(screen.getByRole("button", { name: "Clear cart" }));
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Remove all items from your cart?",
    });
    await user.click(
      within(confirmDialog).getByRole("button", { name: "Keep items" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", {
          name: "Remove all items from your cart?",
        }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Clear cart" }));
    const confirmDialog2 = await screen.findByRole("dialog", {
      name: "Remove all items from your cart?",
    });
    await user.click(
      within(confirmDialog2).getByRole("button", { name: "Clear cart" }),
    );

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
  });

  it("shows Try again error state while preserving visitor badge count when quote fails (AC-14)", async () => {
    const user = userEvent.setup();
    useGuestCartStore.setState({
      guestCartId: "550e8400-e29b-41d4-a716-446655440099",
      updatedAt: new Date().toISOString(),
      lines: [
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID_A,
          quantity: 3,
          addedAt: "2026-11-27T10:00:00.000Z",
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/api/auth/me") {
          return Promise.resolve(jsonResponse({}, 401));
        }
        return Promise.reject(new Error("API offline"));
      }),
    );

    renderWithStorefront(<CartPageContent />);

    expect(
      await screen.findByText("We couldn't load your cart right now"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    // Visitor badge preserves saved count of 3 even while quote fails!
    expect(
      screen.getByRole("button", { name: "Shopping cart, 3 items" }),
    ).toBeInTheDocument();

    // Clicking Try again still leaves saved lines intact.
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(useGuestCartStore.getState().lines).toHaveLength(1);
  });

  it("merges visitor cart on sign in, auto opens drawer with dismissible banner, clears localStorage, and resets immediately on sign out (AC-11, AC-12)", async () => {
    const user = userEvent.setup();
    const originalGuestId = "550e8400-e29b-41d4-a716-446655440077";

    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          guestCartId: originalGuestId,
          updatedAt: new Date().toISOString(),
          lines: [
            {
              productId: PRODUCT_ID,
              variantId: VARIANT_ID_A,
              quantity: 5,
              addedAt: "2026-11-27T10:00:00.000Z",
            },
          ],
        },
      }),
    );

    let mergeCalled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/api/auth/me") {
          return Promise.resolve(jsonResponse(CUSTOMER, 200));
        }
        if (url === "/api/cart/merge") {
          mergeCalled = true;
          return Promise.resolve(
            jsonResponse({
              data: {
                lines: [makeCartLine({ quantity: 3, maxQuantity: 3 })],
                adjustments: [
                  {
                    variantId: VARIANT_ID_A,
                    title: "Sunflower Amigurumi Bear",
                    kind: "LOWERED",
                    quantity: 3,
                  },
                ],
              },
            }),
          );
        }
        if (url === "/api/auth/logout") {
          return Promise.resolve(jsonResponse({ ok: true }, 200));
        }
        return Promise.resolve(
          jsonResponse({ data: { lines: [], adjustments: [] } }),
        );
      }),
    );

    renderWithStorefront(<div>Storefront content</div>);

    const drawer = await screen.findByRole("dialog", { name: "Shopping cart" });
    expect(mergeCalled).toBe(true);
    const mergeRegion = within(drawer).getByRole("region", {
      name: "Cart changes after sign in",
    });
    expect(
      within(mergeRegion).getByText(
        "Some items in your cart changed when you signed in",
      ),
    ).toBeInTheDocument();
    expect(
      within(mergeRegion).getByText(
        "Sunflower Amigurumi Bear: limited to 3 available",
      ),
    ).toBeInTheDocument();

    // Browser cart was cleared and guestCartId rotated after merge succeeded!
    expect(useGuestCartStore.getState().lines).toEqual([]);
    expect(useGuestCartStore.getState().guestCartId).not.toBe(originalGuestId);

    // Dismiss the merge banner and close the drawer.
    await user.click(
      within(mergeRegion).getByRole("button", {
        name: "Dismiss cart changes notice",
      }),
    );
    expect(
      within(drawer).queryByRole("region", {
        name: "Cart changes after sign in",
      }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    // Badge shows account count 3; sign out resets immediately to empty!
    expect(
      await screen.findByRole("button", { name: "Shopping cart, 3 items" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Account menu for Nadia Rahman" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Shopping cart, empty" }),
      ).toBeInTheDocument();
    });
  });
});
