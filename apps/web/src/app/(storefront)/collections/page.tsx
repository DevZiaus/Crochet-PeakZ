import type { Metadata } from "next";
import { CatalogErrorState } from "@/components/catalog/catalog-error-state";
import { CollectionCard } from "@/components/collection-card";
import { Container } from "@/components/container";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { fetchCatalogCategories } from "@/lib/catalog/api";
import { getActiveCurrency } from "@/lib/catalog/currency";
import { getCatalogEnv } from "@/lib/catalog/env";

/**
 * Collections index metadata.
 *
 * @returns Page metadata with a canonical URL and the default OpenGraph image.
 */
export function generateMetadata(): Metadata {
  const { webAppUrl } = getCatalogEnv();
  const title = "Collections";
  const description =
    "Explore the Crochet PeakZ collections, from amigurumi to wearables and scarves.";

  return {
    title,
    description,
    alternates: { canonical: `${webAppUrl}/collections` },
    openGraph: {
      title,
      description,
      url: `${webAppUrl}/collections`,
      images: [{ url: "/images/og-default.webp", alt: "Crochet PeakZ" }],
    },
  };
}

/**
 * Collections index.
 *
 * Only top level categories with at least one visible product in their
 * subtree appear. An empty catalogue renders the empty state instead.
 */
export default async function CollectionsPage() {
  // Reading the currency cookie opts this route into dynamic rendering, so the
  // collection counts always reflect the live catalogue (AC-15, AC-16).
  await getActiveCurrency();

  let categories;
  try {
    categories = await fetchCatalogCategories();
  } catch {
    return (
      <Container className="py-10 sm:py-14">
        <CatalogErrorState
          heading="We could not load the collections"
          description="Something went wrong on our side. Please try again."
        />
      </Container>
    );
  }

  const topLevel = categories.filter(
    (category) => category.parentId === null && category.productCount > 0,
  );

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        title="Collections"
        description="Browse the studio by collection, from amigurumi to wearables."
      />

      {topLevel.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {topLevel.map((category) => (
            <li key={category.id}>
              <CollectionCard category={category} className="h-full" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          heading="No collections yet"
          description="New pieces are on the way. Check back soon."
        />
      )}
    </Container>
  );
}
