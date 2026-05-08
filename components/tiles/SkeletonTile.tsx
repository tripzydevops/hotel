"use client";

export default function SkeletonTile({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`card-blur rounded-[2rem] ${large ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""} flex flex-col gap-0 overflow-hidden border border-white/[0.05]`}
    >
      {/* Header Image Skeleton */}
      <div className="aspect-video w-full skeleton" />
      
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="h-3 w-24 mb-2 skeleton rounded" />
            <div className="h-5 w-40 skeleton rounded" />
          </div>
          <div className="text-right">
            <div className="h-3 w-12 mb-2 skeleton rounded ml-auto" />
            <div className="h-6 w-20 skeleton rounded" />
          </div>
        </div>

        {/* Market Presence Skeleton */}
        <div className="space-y-2 mb-6">
          <div className="h-3 w-32 skeleton rounded" />
          <div className="h-10 w-full skeleton rounded-xl" />
          <div className="h-10 w-full skeleton rounded-xl opacity-50" />
        </div>

        <div className="mt-auto pt-5 border-t border-white/[0.05] flex gap-2">
          <div className="h-11 flex-1 skeleton rounded-xl" />
          <div className="h-11 w-11 skeleton rounded-xl" />
          <div className="h-11 w-11 skeleton rounded-xl" />
        </div>
      </div>
    </div>
  );
}
