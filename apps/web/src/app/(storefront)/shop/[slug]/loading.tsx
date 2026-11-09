import { Container } from "@/components/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Product detail skeleton shown while the product loads. */
export default function ProductLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading this piece</span>
      <Container className="py-10 sm:py-14">
        <Skeleton className="mb-6 h-4 w-64 max-w-full" />
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            <Skeleton className="aspect-[4/5] w-full rounded-xl" />
            <div className="hidden grid-cols-4 gap-3 md:grid">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-square w-full rounded-md"
                />
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-11 w-24" />
                <Skeleton className="h-11 w-24" />
                <Skeleton className="h-11 w-24" />
              </div>
            </div>
            <Skeleton className="h-11 w-full max-w-xs" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        </div>
      </Container>
    </div>
  );
}
