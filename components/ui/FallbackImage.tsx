"use client";

import { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";
import { Hotel, ImageOff } from "lucide-react";

interface FallbackImageProps extends Omit<ImageProps, "onError"> {
  fallbackType?: "hotel" | "generic";
  iconClassName?: string;
}

export default function FallbackImage({
  src,
  alt,
  fallbackType = "hotel",
  iconClassName = "w-8 h-8 text-[var(--text-muted)]",
  ...props
}: FallbackImageProps) {
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
    setError(false);
  }, [src]);

  const handleError = () => {
    setError(true);
  };

  if (error || !imgSrc) {
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

  return <Image {...props} src={imgSrc} alt={alt} onError={handleError} />;
}
