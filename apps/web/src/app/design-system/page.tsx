"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  Inbox,
  Package,
  PackageOpen,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
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

const placeholderImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e7efee"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="24" fill="#0f5c5c">Placeholder</text></svg>',
  );

const placeholderPortrait =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#b07d22"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="34" fill="#1a1408">AR</text></svg>',
  );

/**
 * Child that throws on demand so the ErrorBoundary fallback can be checked.
 * It only throws once the button is pressed, so the route still prerenders.
 * The console error React prints when a boundary catches is expected here.
 */
function ErrorBoundaryTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error(
      "Fixture error: a child threw so the ErrorBoundary fallback could be checked.",
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => {
        setShouldThrow(true);
      }}
    >
      <TriangleAlert className="size-4" />
      Trigger the error boundary
    </Button>
  );
}

/**
 * Temporary showcase page for browser checks of the design system foundation
 * (spec 0003). Every composed component and every Shadcn primitive renders here
 * or on `/design-system/admin`, so acceptance criteria can be driven in a real
 * browser rather than reasoned about from the source. Remove this route before
 * the storefront ships.
 */
export default function DesignSystemShowcase() {
  const [quantity, setQuantity] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [restockAlerts, setRestockAlerts] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <Container as="main" className="py-8">
        <PageHeader
          title="Design system showcase"
          description="Temporary route for browser checks of the design system foundation (spec 0003). Covers tokens, primitives, composed components, states, overlays and feedback."
        >
          <Button asChild>
            <Link href="/design-system/admin">
              Open the admin layout fixture
              <ChevronDown className="size-4" />
            </Link>
          </Button>
        </PageHeader>

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

        <Divider label="Foundation" />

        <Section id="layout" className="space-y-6 py-8">
          <h2 className="text-2xl">Buttons and badges</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add to cart">
              <Package className="size-5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>

          <h2 className="text-2xl">Card</h2>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Monthly revenue</CardTitle>
              <CardDescription>
                Orders delivered in the current month.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">Live</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold text-foreground">৳184,500</p>
              <p className="text-sm text-muted-foreground">
                12% up on last month
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">
                View report
              </Button>
            </CardFooter>
          </Card>

          <h2 className="text-2xl">Avatar</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar size="lg">
              <AvatarImage src={placeholderPortrait} alt="Amina Rahman" />
              <AvatarFallback>AR</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>MR</AvatarFallback>
            </Avatar>
            <AvatarGroup>
              <Avatar>
                <AvatarFallback>AR</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>MR</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>SK</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+9</AvatarGroupCount>
            </AvatarGroup>
          </div>
        </Section>

        <Divider label="States" />

        <Section id="states" className="space-y-6 py-8">
          <h2 className="text-2xl">Loading</h2>
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-24 w-full max-w-md" />
            <Skeleton className="size-12 rounded-full" />
          </div>

          <h2 className="text-2xl">Error</h2>
          <ErrorBoundary>
            <ErrorBoundaryTrigger />
          </ErrorBoundary>

          <h2 className="text-2xl">Empty, with an action</h2>
          <EmptyState
            icon={Inbox}
            heading="Nothing here yet"
            description="Empty state with an optional call to action."
            action={{ label: "Browse products", onClick: () => undefined }}
          />

          <h2 className="text-2xl">Empty, without an action</h2>
          <EmptyState
            icon={PackageOpen}
            heading="No saved patterns"
            description="Empty state with no call to action, so the optional action can be checked."
          />
        </Section>

        <Divider label="Overlays" />

        <Section id="overlays" className="space-y-6 py-8">
          <h2 className="text-2xl">Dialog and dropdown menu</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish this product?</DialogTitle>
                  <DialogDescription>
                    The product becomes visible in the storefront as soon as it
                    is published.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button>Publish</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Actions
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Ocean Beanie</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Section>

        <Divider label="Forms" />

        <Section id="forms" className="space-y-6 py-8">
          <h2 className="text-2xl">Fields and controls</h2>
          <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
            <FormField
              label="Email"
              description="We only use this for order updates."
              error="Enter a valid email address."
              required
              htmlFor="showcase-email"
            >
              <Input id="showcase-email" type="email" />
            </FormField>

            <FormField
              label="Notes for the maker"
              description="Anything you want added to this order."
              htmlFor="showcase-notes"
            >
              <Textarea
                id="showcase-notes"
                placeholder="Gift wrap the beanie in the gold paper, please."
              />
            </FormField>

            <FormField
              label="Preferred currency"
              description="Used for prices on every page."
              htmlFor="showcase-currency"
            >
              <Select>
                <SelectTrigger id="showcase-currency" className="w-full">
                  <SelectValue placeholder="Choose a currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bdt">BDT, Bangladeshi Taka</SelectItem>
                  <SelectItem value="usd">USD, US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="showcase-marketing"
                checked={marketingOptIn}
                onCheckedChange={(checked) => {
                  setMarketingOptIn(checked === true);
                }}
              />
              <label htmlFor="showcase-marketing" className="text-sm">
                Email me about new patterns
              </label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="showcase-restock"
                checked={restockAlerts}
                onCheckedChange={setRestockAlerts}
              />
              <label htmlFor="showcase-restock" className="text-sm">
                Tell me when a sold out item is back
              </label>
            </div>
          </div>

          <h2 className="text-2xl">File upload</h2>
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

          <h2 className="text-2xl">Product cards</h2>
          <div className="grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <ProductCard
              slug="amigurumi-fox-pattern"
              title="Amigurumi Fox Pattern"
              imageUrl={placeholderImage}
              priceBdt={450}
              priceUsd={4.5}
              compareAtBdt={600}
              compareAtUsd={6}
              averageRating={5}
              reviewCount={31}
              productType="DIGITAL"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="size-4" aria-hidden="true" />
            <span>Product cards hide the rating when none is given.</span>
          </div>
        </Section>

        <Divider label="Feedback" />

        <Section id="feedback" className="space-y-6 py-8">
          <h2 className="text-2xl">Toasts</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() =>
                toast.success("Added to cart", {
                  description: "Ocean Beanie, 1 item.",
                })
              }
            >
              Fire a success toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error("Payment could not be completed", {
                  description: "Check the card details and try again.",
                })
              }
            >
              Fire an error toast
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Toasts render through the Sonner Toaster mounted in the root layout
            and pick up the popover tokens in both themes.
          </p>
        </Section>
      </Container>

      <Footer />
    </div>
  );
}
