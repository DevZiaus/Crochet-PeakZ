import { Container } from "@/components/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Collection page skeleton shown while the category and products load. */
export default function CollectionLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading this collection</span>
      <Container className="py-10 sm:py-14">
        <Skeleton className="mb-6 h-4 w-64 max-w-full" />
        <div className="space-y-2 pb-8">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
