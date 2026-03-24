"use client";

import { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";
import { Hotel, ImageOff } from "lucide-react";

interface FallbackImageProps extends Omit<ImageProps, "onError"> {
  fallbackType?: "hotel" | "generic";
  iconClassName?: string;
  priority?: boolean;
}

export default function FallbackImage({
  src,
  alt,
  fallbackType = "hotel",
  iconClassName = "w-8 h-8 text-[var(--text-muted)]",
  priority = false,
  ...props
}: FallbackImageProps) {
  const [error, setError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setError(false);
  }

  const handleError = () => {
    setError(true);
  };

  if (error || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--soft-gold)]/5">
        {fallbackType === "hotel" ? (
          <Hotel className={iconClassName} />
        ) : (
          <ImageOff className={iconClassName} />
        )}
      </div>
    );
  }

  return <Image {...props} src={src} alt={alt} onError={handleError} />;
}
