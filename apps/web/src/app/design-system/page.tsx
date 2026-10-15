"use client";

import { useState } from "react";
import { Inbox, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/container";
import { Section } from "@/components/section";
import { PageHeader } from "@/components/page-header";
import { Divider } from "@/components/divider";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { EmptyState } from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";
import { StarRating } from "@/components/star-rating";
import { PriceDisplay } from "@/components/price-display";
import { QuantityStepper } from "@/components/quantity-stepper";
import { ProductCard } from "@/components/product-card";
import { FormField } from "@/components/form-field";
import { FileUploadZone } from "@/components/file-upload-zone";
import { Input } from "@/components/ui/input";

const placeholderImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e7efee"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="24" fill="#0f5c5c">Placeholder</text></svg>',
  );

/**
 * Temporary showcase page for browser checks of the design system foundation.
 * Remove this route before the storefront ships.
 */
export default function DesignSystemShowcase() {
  const [quantity, setQuantity] = useState(1);
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <Container as="main" className="py-8">
        <PageHeader
          title="Design system showcase"
          description="Temporary route for browser checks of steps 6, 8, 9, 10, and 11."
        />

        <Section id="navigation" className="space-y-6 py-8">
          <h2 className="text-2xl">Breadcrumbs</h2>
          <Breadcrumbs
            items={[
              { label: "Shop", href: "/" },
              { label: "Hats", href: "/" },
              { label: "Beanie" },
            ]}
          />
        </Section>

        <Divider label="Layout" />

        <Section id="layout" className="space-y-4 py-8">
          <h2 className="text-2xl">Buttons, badges, and state</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg">Skeleton</h3>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-24 w-full max-w-md" />
          </div>
          <ErrorBoundary>
            <EmptyState
              icon={Inbox}
              heading="Nothing here yet"
              description="Empty state with an optional call to action."
              action={{ label: "Browse products", onClick: () => undefined }}
            />
          </ErrorBoundary>
        </Section>

        <Divider label="Forms" />

        <Section id="forms" className="space-y-6 py-8">
          <h2 className="text-2xl">Form field and file upload</h2>
          <FormField
            label="Email"
            description="We only use this for order updates."
            error="Enter a valid email address."
            required
            htmlFor="showcase-email"
          >
            <Input id="showcase-email" type="email" />
          </FormField>
          <FileUploadZone
            onFiles={setFiles}
            accept={["image/png", "image/jpeg"]}
            maxSize={2 * 1024 * 1024}
          />
          <p className="text-sm text-muted-foreground">
            Selected files: {files.length}
          </p>
        </Section>

        <Divider label="Commerce" />

        <Section id="commerce" className="space-y-6 py-8">
          <h2 className="text-2xl">Star rating (1 to 5)</h2>
          <div className="flex flex-col gap-3">
            <StarRating rating={1} showValue />
            <StarRating rating={2.5} showValue />
            <StarRating rating={3.5} size="lg" showValue />
            <StarRating rating={5} size="lg" showValue />
          </div>

          <h2 className="text-2xl">Price and quantity</h2>
          <div className="flex flex-wrap items-center gap-6">
            <PriceDisplay
              priceBdt={1200}
              priceUsd={12}
              compareAtBdt={1500}
              compareAtUsd={15}
              size="lg"
            />
            <PriceDisplay priceBdt={1200} priceUsd={12} activeCurrency="USD" />
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={10}
            />
          </div>

          <h2 className="text-2xl">Product card</h2>
          <div className="grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ProductCard
              slug="ocean-beanie"
              title="Ocean Beanie"
              imageUrl={placeholderImage}
              priceBdt={1200}
              priceUsd={12}
              averageRating={4.5}
              reviewCount={18}
              productType="STANDARD"
            />
            <ProductCard
              slug="custom-tote"
              title="Custom Tote"
              imageUrl={placeholderImage}
              priceBdt={3200}
              priceUsd={32}
              averageRating={3}
              reviewCount={4}
              productType="MADE_TO_ORDER"
              inStock={false}
            />
            <ProductCard
              slug="one-of-a-kind-shawl"
              title="One of a Kind Shawl"
              imageUrl={placeholderImage}
              priceBdt={8500}
              priceUsd={85}
              productType="ONE_OF_A_KIND"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="size-4" aria-hidden="true" />
            <span>Product cards hide the rating when none is given.</span>
          </div>
        </Section>
      </Container>

      <Footer />
    </div>
  );
}
