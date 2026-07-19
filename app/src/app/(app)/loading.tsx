import { Skeleton } from "@/components/ui/primitives";

// Route-Ladezustand (Skeleton) für den angemeldeten Bereich – vermeidet leere Zwischenzustände.
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Inhalt wird geladen…</span>
    </div>
  );
}
