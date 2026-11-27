import type { CartRepository } from "../../domain/ports/cart-repository.js";
import type { CatalogRepository } from "../../domain/ports/catalog-repository.js";
import type { Clock } from "../../domain/ports/clock.js";
import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";

/** Dependencies required by cart quote use cases. */
export interface CartQuoteDependencies {
  /** Catalog repository providing batch product/variant snapshots. */
  catalog: CatalogRepository;
  /** Cloudinary image URL resolver. */
  imageUrls: ImageUrlResolver;
  /** Clock for default timestamps and expiry evaluation. */
  clock: Clock;
}

/** Dependencies required by signed in account cart use cases. */
export interface AccountCartDependencies {
  /** Row locked cart persistence repository. */
  carts: CartRepository;
  /** Cloudinary image URL resolver. */
  imageUrls: ImageUrlResolver;
  /** Clock for expiry and write timestamps. */
  clock: Clock;
}
