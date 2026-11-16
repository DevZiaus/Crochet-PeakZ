import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";

/**
 * Cloudinary delivery URL resolver.
 *
 * Database values are public IDs. Absolute HTTPS URLs pass through only when
 * they are on `res.cloudinary.com`; every other absolute URL, including HTTP
 * and foreign hosts, resolves to null so the UI falls back to its placeholder.
 * The host allowlist is deliberate hardening. Slashes inside a public ID are
 * preserved.
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
      try {
        const url = new URL(value);
        return url.protocol === "https:" &&
          url.hostname === "res.cloudinary.com"
          ? value
          : null;
      } catch {
        return null;
      }
    }

    const encodedPublicId = value
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/f_auto,q_auto/${encodedPublicId}`;
  }
}
