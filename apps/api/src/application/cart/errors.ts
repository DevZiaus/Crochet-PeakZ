import type { CartDto } from "@crochet-peakz/shared";

/** Domain/application error codes thrown by account cart use cases. */
export type CartErrorCode =
  "NOT_IN_CART" | "ITEM_UNAVAILABLE" | "SESSION_INVALID";

/**
 * Expected failure raised by an account cart use case and mapped by the
 * presentation layer to its HTTP status code.
 */
export class CartError extends Error {
  /** Machine readable error code. */
  readonly code: CartErrorCode;
  /** Fresh cart snapshot returned on `409 ITEM_UNAVAILABLE`. */
  readonly cartData?: CartDto;

  constructor(
    code: CartErrorCode,
    message: string,
    options?: { cartData?: CartDto },
  ) {
    super(message);
    this.name = "CartError";
    this.code = code;
    if (options?.cartData !== undefined) {
      this.cartData = options.cartData;
    }
  }
}
