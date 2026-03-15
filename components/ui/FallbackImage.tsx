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
  const [isLoading, setIsLoading] = useState(true);
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setError(false);
    setIsLoading(true);
  }

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (error || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--deep-ocean-accent)]">
        {fallbackType === "hotel" ? (
          <Hotel className={iconClassName} />
        ) : (
          <ImageOff className={iconClassName} />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-10 skeleton" />
      )}
      <Image 
        {...props} 
        src={src} 
        alt={alt} 
        onError={handleError} 
        onLoad={handleLoad}
        className={`${props.className || ""} ${isLoading ? "opacity-0" : "opacity-100 transition-opacity duration-500"}`}
      />
    </div>
  );
}
