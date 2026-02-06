"use client";

export default function SkeletonTile({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`glass-card ${large ? "p-8 sm:col-span-2 lg:col-span-2 lg:row-span-2" : "p-5"} flex flex-col gap-4 overflow-hidden`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`${large ? "w-16 h-16" : "w-10 h-10"} rounded-xl skeleton`}
        />
        <div className="flex-1">
          <div
            className={`h-3 ${large ? "w-32 mb-3" : "w-24 mb-2"} skeleton rounded`}
          />
          <div className={`h-4 ${large ? "w-48" : "w-32"} skeleton rounded`} />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-6">
        <div
          className={`${large ? "h-16 w-48" : "h-10 w-24"} skeleton rounded-xl mb-3`}
        />
        <div className="h-3 w-20 skeleton rounded" />
      </div>

      <div className="pt-4 border-t border-white/5 flex justify-between">
        <div className="h-4 w-12 skeleton rounded" />
        <div className="h-4 w-12 skeleton rounded" />
        <div className="h-4 w-12 skeleton rounded" />
      </div>
    </div>
  );
}
