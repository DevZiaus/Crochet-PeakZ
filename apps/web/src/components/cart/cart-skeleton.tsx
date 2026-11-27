import { Skeleton } from "@/components/ui/skeleton";

/** Line skeletons displayed inside the cart drawer while loading (AC-14). */
export function CartLinesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-label="Loading shopping cart"
      aria-busy="true"
      className="divide-y divide-border"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex gap-4 py-5 first:pt-0 last:pb-0">
          <Skeleton className="size-20 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2.5">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-3.5 w-2/5" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-11 w-32 rounded-full" />
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full `/cart` page skeleton matching the two column layout (AC-14). */
export function CartPageSkeleton() {
  return (
    <div
      aria-label="Loading shopping cart"
      aria-busy="true"
      className="grid gap-8 lg:grid-cols-12"
    >
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-8">
        <CartLinesSkeleton count={3} />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-4">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
