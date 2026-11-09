import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";

/**
 * Cloudinary delivery URL resolver.
 *
 * Database values are public IDs. Absolute URLs pass through unchanged, and
 * slashes inside a public ID are preserved.
 */
export class CloudinaryImageUrlResolver implements ImageUrlResolver {
  /**
   * @param cloudName Cloudinary cloud name.
   */
  constructor(private readonly cloudName: string) {}

  /** @inheritdoc */
  resolve(publicId: string | null | undefined): string | null {
    if (publicId === null || publicId === undefined) {
      return null;
    }

    const value = publicId.trim();
    if (value.length === 0) {
      return null;
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }

    return `https://res.cloudinary.com/${this.cloudName}/image/upload/f_auto,q_auto/${value}`;
  }
}
