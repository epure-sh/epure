import { PolarCard } from "@/components/kit/polar-card";
import { Skeleton } from "@/ui/skeleton";

export function AlertCardSkeleton() {
  return (
    <li className="list-none">
      <PolarCard padding="m">
        <Skeleton className="h-4 w-[55%]" />
        <Skeleton className="mt-2 h-3 w-[40%]" />
      </PolarCard>
    </li>
  );
}
