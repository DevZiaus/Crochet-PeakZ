/**
 * Resolves a stored Cloudinary public ID into a delivery URL.
 *
 * Implemented at the API presentation edge so database values stay untouched.
 */
export interface ImageUrlResolver {
  /**
   * Resolves one image reference.
   *
   * @param publicId Cloudinary public ID or absolute URL, or null.
   * @returns A delivery URL, or null when there is no image.
   */
  resolve(publicId: string | null | undefined): string | null;
}
