"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Local placeholder committed with the catalog feature. */
export const PRODUCT_IMAGE_PLACEHOLDER = "/images/product-placeholder.webp";

interface ProductImageProps {
  /** Resolved image URL, or null when the product has no image. */
  src: string | null;
  /** Alt text for the image. */
  alt: string;
  /** Responsive sizes hint. */
  sizes?: string;
  /** Whether this image is the largest contentful paint candidate. */
  priority?: boolean;
  /** Additional classes for the image element. */
  className?: string;
}

/**
 * Product image with a local fallback.
 *
 * A missing URL and a remote image that fails to load both resolve to the
 * committed placeholder, so a broken upload never leaves a broken layout.
 */
export function ProductImage({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  priority = false,
  className,
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showFallback = src === null || failedSrc === src;

  return (
    <Image
      src={showFallback ? PRODUCT_IMAGE_PLACEHOLDER : src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => {
        setFailedSrc(src);
      }}
      className={cn("object-cover", className)}
    />
  );
}
