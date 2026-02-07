import { Skeleton } from '@/components/ui/skeleton';

export function ResultCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-white shadow-sm border-l-4 border-l-muted animate-pulse">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Position indicator skeleton */}
        <Skeleton className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full" />
        
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name skeleton */}
          <Skeleton className="h-5 w-3/4 sm:w-1/2" />
          
          {/* Location skeleton */}
          <Skeleton className="h-4 w-1/2 sm:w-1/3" />
          
          {/* Distance skeleton */}
          <div className="flex items-center gap-1 mt-1.5">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        
        {/* Button skeleton (desktop only) */}
        <Skeleton className="hidden sm:block h-8 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function ResultsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <ResultCardSkeleton key={index} />
      ))}
    </div>
  );
}
