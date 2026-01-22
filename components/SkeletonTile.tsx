"use client";

export default function SkeletonTile({ large = false }: { large?: boolean }) {
  return (
    <div className={`glass-card p-6 ${large ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""} flex flex-col gap-4 overflow-hidden`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg skeleton" />
        <div className="flex-1">
          <div className="h-3 w-24 skeleton rounded mb-2" />
          <div className="h-4 w-32 skeleton rounded" />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center py-6">
        <div className="h-12 w-32 skeleton rounded-xl mb-2" />
        <div className="h-3 w-16 skeleton rounded" />
      </div>

      <div className="pt-4 border-t border-white/5 flex justify-between">
        <div className="h-4 w-12 skeleton rounded" />
        <div className="h-4 w-12 skeleton rounded" />
        <div className="h-4 w-12 skeleton rounded" />
      </div>
    </div>
  );
}
