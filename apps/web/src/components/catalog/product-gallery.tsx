"use client";

import { useState } from "react";
import type { ProductImageDto } from "@crochet-peakz/shared";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product-image";

/** Props for the product gallery. */
export interface ProductGalleryProps {
  images: ProductImageDto[];
  productTitle: string;
}

/**
 * Product gallery. Desktop shows one main image with a thumbnail strip.
 * Mobile shows a swipeable, scroll snapping row of full width images.
 */
export function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted">
        <ProductImage
          src={null}
          alt={`${productTitle} image coming soon`}
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
      </div>
    );
  }

  const selected = images[selectedIndex] ?? images[0];

  return (
    <div>
      <div className="relative hidden aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted md:block">
        <ProductImage
          src={selected?.url ?? null}
          alt={selected?.alt ?? productTitle}
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:hidden">
        {images.map((image, index) => (
          <div
            key={`${image.url}-${String(index)}`}
            className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden rounded-lg border border-border bg-muted"
          >
            <ProductImage
              src={image.url}
              alt={image.alt ?? `${productTitle} image ${String(index + 1)}`}
              sizes="100vw"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {images.length > 1 ? (
        <ul className="mt-4 hidden grid-cols-4 gap-3 md:grid">
          {images.map((image, index) => (
            <li key={`${image.url}-thumb-${String(index)}`}>
              <button
                type="button"
                onClick={() => {
                  setSelectedIndex(index);
                }}
                aria-label={`View image ${String(index + 1)} of ${String(images.length)}`}
                aria-pressed={index === selectedIndex}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-muted transition-colors duration-200 motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  index === selectedIndex
                    ? "border-primary"
                    : "border-transparent hover:border-input",
                )}
              >
                <ProductImage src={image.url} alt="" sizes="12vw" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
