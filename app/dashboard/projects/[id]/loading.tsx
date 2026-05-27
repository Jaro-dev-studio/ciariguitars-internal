import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectDetailLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="mb-2 h-5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border py-3 last:border-b-0"
              >
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-lg border border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
