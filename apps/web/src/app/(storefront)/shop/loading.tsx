import { Container } from "@/components/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Shop skeleton shown while filters and products load. */
export default function ShopLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading the shop</span>
      <Container className="py-10 sm:py-14">
        <div className="space-y-2 pb-8">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
          <div className="mb-8 hidden space-y-6 rounded-xl border border-border bg-card p-5 lg:block">
            <Skeleton className="h-5 w-20" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <Skeleton className="h-11 w-28 lg:hidden" />
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
          </div>
        </div>
      </Container>
    </div>
  );
}
