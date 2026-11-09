import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import { CatalogErrorState } from "@/components/catalog/catalog-error-state";
import { FilterSidebar } from "@/components/catalog/filter-sidebar";
import { MobileFilterDrawer } from "@/components/catalog/mobile-filter-drawer";
import { Pagination } from "@/components/catalog/pagination";
import { SortSelect } from "@/components/catalog/sort-select";
import { Container } from "@/components/container";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProductGrid } from "@/components/product-grid";
import {
  fetchCatalogCategories,
  fetchCatalogProducts,
} from "@/lib/catalog/api";
import { getActiveCurrency } from "@/lib/catalog/currency";
import { getCatalogEnv } from "@/lib/catalog/env";
import {
  buildShopHref,
  parseCatalogSearchParams,
  toCatalogListParams,
} from "@/lib/catalog/search-params";

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Shop metadata.
 *
 * A single category view with page 1, the default sort, and no other filters
 * canonicalises to its collection page. Every other view canonicalises to its
 * own normalized URL.
 *
 * @param props Route props with the raw search parameters.
 * @returns Page metadata.
 */
export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const { webAppUrl } = getCatalogEnv();
  const title = "Shop handmade crochet | Crochet PeakZ";
  const description =
    "Browse handmade crochet pieces, filter by collection, product type, and price, and find something made to be kept.";
  let canonical = `${webAppUrl}/shop`;

  try {
    const categories = await fetchCatalogCategories();
    const state = parseCatalogSearchParams(
      await searchParams,
      new Set(categories.map((category) => category.slug)),
    );
    const [onlyCategory] = state.categories;
    const isSingleCollection =
      onlyCategory !== undefined &&
      state.categories.length === 1 &&
      state.page === 1 &&
      state.sort === "newest" &&
      state.types.length === 0 &&
      state.minPrice === undefined &&
      state.maxPrice === undefined &&
      state.featured !== true;

    canonical = isSingleCollection
      ? `${webAppUrl}/collections/${onlyCategory}`
      : `${webAppUrl}${buildShopHref(state)}`;
  } catch {
    // Keep the self canonical when categories cannot be loaded.
  }

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: "/images/og-default.webp", alt: "Crochet PeakZ" }],
    },
  };
}

/**
 * Shop listing.
 *
 * Categories load first because the forgiving URL parser needs the known
 * category slugs. Products then load with the parsed state.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const activeCurrency = await getActiveCurrency();

  let categories: CategorySummaryDto[];
  try {
    categories = await fetchCatalogCategories();
  } catch {
    return (
      <Container className="py-10 sm:py-14">
        <CatalogErrorState
          heading="We could not load the shop"
          description="Something went wrong on our side. Please try again."
        />
      </Container>
    );
  }

  const state = parseCatalogSearchParams(
    await searchParams,
    new Set(categories.map((category) => category.slug)),
  );

  let response;
  try {
    response = await fetchCatalogProducts(
      toCatalogListParams(state, activeCurrency),
    );
  } catch {
    return (
      <Container className="py-10 sm:py-14">
        <CatalogErrorState
          heading="We could not load the shop"
          description="Something went wrong on our side. Please try again."
        />
      </Container>
    );
  }

  if (response.meta.page !== state.page) {
    redirect(buildShopHref(state, { page: response.meta.page }));
  }

  const countLabel =
    response.meta.total === 1
      ? "1 piece"
      : `${String(response.meta.total)} pieces`;

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        title="Shop"
        description="Handmade crochet pieces, from amigurumi friends to cosy scarves."
      />

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
        <FilterSidebar
          categories={categories}
          state={state}
          currency={activeCurrency}
        />

        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <MobileFilterDrawer
                categories={categories}
                state={state}
                currency={activeCurrency}
              />
              <p
                className="text-sm text-muted-foreground"
                aria-live="polite"
                aria-atomic="true"
              >
                {countLabel}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                id="shop-sort-label"
                className="text-sm font-medium text-muted-foreground"
              >
                Sort by
              </span>
              <SortSelect value={state.sort} />
            </div>
          </div>

          {response.data.length > 0 ? (
            <>
              <ProductGrid
                products={response.data}
                activeCurrency={activeCurrency}
              />
              <Pagination
                className="mt-10"
                page={response.meta.page}
                totalPages={response.meta.totalPages}
                hrefForPage={(page) => buildShopHref(state, { page })}
              />
            </>
          ) : (
            <EmptyState
              heading="No pieces match these filters"
              description="Try removing a filter or widening the price range."
              action={{ label: "Clear all filters", href: "/shop" }}
            />
          )}
        </div>
      </div>
    </Container>
  );
}
