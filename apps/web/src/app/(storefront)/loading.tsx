import { Container } from "@/components/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Home page skeleton shown while featured products and collections load. */
export default function StorefrontHomeLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading the storefront</span>
      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <Skeleton className="mx-auto h-4 w-44" />
          <Skeleton className="mx-auto h-12 w-full max-w-xl" />
          <Skeleton className="mx-auto h-4 w-full max-w-lg" />
          <Skeleton className="mx-auto h-4 w-3/4 max-w-md" />
          <div className="flex justify-center gap-3 pt-2">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-40" />
          </div>
        </div>
      </Container>
      <Container className="pb-16">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
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
