import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { CategoryDetailDto } from "@crochet-peakz/shared";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CatalogErrorState } from "@/components/catalog/catalog-error-state";
import { Pagination } from "@/components/catalog/pagination";
import { SortSelect } from "@/components/catalog/sort-select";
import { CollectionCard } from "@/components/collection-card";
import { Container } from "@/components/container";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProductGrid } from "@/components/product-grid";
import {
  fetchCatalogCategory,
  fetchCatalogProducts,
  isCatalogNotFound,
} from "@/lib/catalog/api";
import { getActiveCurrency } from "@/lib/catalog/currency";
import { getCatalogEnv } from "@/lib/catalog/env";
import {
  hasUnsupportedCollectionParams,
  parseCatalogSearchParams,
  type CatalogSearchState,
} from "@/lib/catalog/search-params";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Builds a collection URL for a page and sort.
 *
 * @param slug Collection slug.
 * @param state Parsed URL state.
 * @param overrides Values to replace.
 * @returns A relative collection URL.
 */
function buildCollectionHref(
  slug: string,
  state: CatalogSearchState,
  overrides: Partial<CatalogSearchState> = {},
): string {
  const merged = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (merged.sort !== "newest") {
    params.set("sort", merged.sort);
  }
  if (merged.page > 1) {
    params.set("page", String(merged.page));
  }
  const query = params.toString();
  return query.length > 0
    ? `/collections/${slug}?${query}`
    : `/collections/${slug}`;
}

/**
 * Collection page metadata.
 *
 * @param props Route params.
 * @returns Metadata with a self canonical and the collection cover image.
 */
export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { webAppUrl } = getCatalogEnv();

  try {
    const category = await fetchCatalogCategory(slug);
    const title = category.name;
    const description =
      category.description ??
      `Handmade crochet pieces from the ${category.name} collection.`;

    return {
      title,
      description,
      alternates: { canonical: `${webAppUrl}/collections/${slug}` },
      openGraph: {
        title,
        description,
        url: `${webAppUrl}/collections/${slug}`,
        images: [
          {
            url: category.coverImageUrl ?? "/images/og-default.webp",
            alt: category.coverImageAlt ?? category.name,
          },
        ],
      },
    };
  } catch (error) {
    if (isCatalogNotFound(error)) {
      return {
        title: "Collection not found",
        robots: { index: false },
      };
    }
    return { title: "Handmade crochet collection" };
  }
}

/**
 * Collection landing page.
 *
 * A parent collection shows its nonempty children and includes products from
 * its whole subtree. A child collection shows its own products.
 */
export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { slug } = await params;
  const activeCurrency = await getActiveCurrency();

  let category: CategoryDetailDto;
  try {
    category = await fetchCatalogCategory(slug);
  } catch (error) {
    if (isCatalogNotFound(error)) {
      notFound();
    }
    return (
      <Container className="py-10 sm:py-14">
        <CatalogErrorState
          heading="We could not load this collection"
          description="Something went wrong on our side. Please try again."
          headingLevel="h1"
        />
      </Container>
    );
  }

  const rawSearchParams = await searchParams;
  const state = parseCatalogSearchParams(
    rawSearchParams,
    new Set([category.slug]),
  );

  // Collection pages only support sort and page. Drop any other catalog
  // filter instead of leaving a URL that looks filtered but is not.
  if (hasUnsupportedCollectionParams(rawSearchParams)) {
    redirect(buildCollectionHref(slug, state));
  }

  let response;
  try {
    response = await fetchCatalogProducts({
      category: [category.slug],
      currency: activeCurrency,
      sort: state.sort,
      page: state.page,
      limit: 12,
    });
  } catch {
    return (
      <Container className="py-10 sm:py-14">
        <CatalogErrorState
          heading="We could not load this collection"
          description="Something went wrong on our side. Please try again."
          headingLevel="h1"
        />
      </Container>
    );
  }

  if (response.meta.page !== state.page) {
    redirect(buildCollectionHref(slug, state, { page: response.meta.page }));
  }

  const children = category.children.filter((child) => child.productCount > 0);
  const breadcrumbItems = [
    { label: "Collections", href: "/collections" },
    ...category.breadcrumb.map((entry) => ({
      label: entry.name,
      href: `/collections/${entry.slug}`,
    })),
    { label: category.name },
  ];
  const countLabel =
    response.meta.total === 1
      ? "1 piece"
      : `${String(response.meta.total)} pieces`;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbItems} className="mb-6" />
      <PageHeader
        title={category.name}
        description={category.description ?? undefined}
      />

      {children.length > 0 && (
        <section aria-labelledby="child-collections-heading" className="mb-12">
          <h2
            id="child-collections-heading"
            className="mb-5 font-heading text-2xl font-semibold text-foreground"
          >
            Inside this collection
          </h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <li key={child.id}>
                <CollectionCard category={child} className="h-full" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p
          className="text-sm text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {countLabel}
        </p>
        <div className="flex items-center gap-3">
          <span
            id="collection-sort-label"
            className="text-sm font-medium text-muted-foreground"
          >
            Sort by
          </span>
          <SortSelect value={state.sort} labelId="collection-sort-label" />
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
            hrefForPage={(page) => buildCollectionHref(slug, state, { page })}
          />
        </>
      ) : (
        <EmptyState
          heading="Nothing here yet"
          description="This collection is waiting for its first piece. Explore the rest of the shop in the meantime."
          action={{ label: "Browse all pieces", href: "/shop" }}
        />
      )}
    </Container>
  );
}
