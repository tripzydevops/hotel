import { Image as ImageIcon } from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";

interface TabGalleryProps {
  normalizedImages: any[];
  t: (key: string) => string;
}

export function TabGallery({ normalizedImages, t }: TabGalleryProps) {
  return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {normalizedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-video rounded-lg overflow-hidden bg-[var(--deep-ocean-accent)] relative group cursor-pointer border border-[var(--glass-border)]"
                >
                  <FallbackImage
                    src={img.original || img.thumbnail || ""}
                    alt={`Gallery ${idx}`}
                    fill
                    className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    // @ts-ignore
                    iconClassName="w-6 h-6 text-[var(--soft-gold)]/20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--deep-ocean)]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 z-10">
                    <span className="text-[9px] font-black text-[var(--overlay-text)] uppercase tracking-widest px-2 py-1 bg-[var(--soft-gold)]/20 backdrop-blur-md rounded border border-[var(--overlay-border)]">
                      {t("common.view")} Full Res
                    </span>
                  </div>
                </div>
              ))}
              {normalizedImages.length === 0 && (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 text-[var(--text-muted)] bg-[var(--glass-bg)] rounded-xl border border-dashed border-[var(--glass-border)]">
                   <ImageIcon className="w-12 h-12 opacity-10" />
                  <p className="text-[10px] uppercase font-black tracking-widest">{t("hotelDetails.noImages")}</p>
                </div>
              )}
            </div>
  );
}
