import type { CatalogRepository } from "../../domain/ports/catalog-repository.js";
import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";

/** Dependencies the catalog use cases need. */
export interface CatalogDependencies {
  /** Catalog persistence port. */
  catalog: CatalogRepository;
  /** Cloudinary delivery URL resolver. */
  imageUrls: ImageUrlResolver;
}
