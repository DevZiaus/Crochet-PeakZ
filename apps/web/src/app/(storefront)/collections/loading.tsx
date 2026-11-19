import { Container } from "@/components/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Collections index skeleton shown while categories load. */
export default function CollectionsLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading the collections</span>
      <Container className="py-10 sm:py-14">
        <div className="space-y-2 pb-8">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-xl" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
