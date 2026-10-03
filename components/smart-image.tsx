"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { cn, initials } from "@/lib/utils";

/**
 * next/image with a graceful graphite fallback when the source is missing or fails.
 */
export function SmartImage({
  src,
  alt,
  fallbackLabel,
  className,
  ...props
}: Omit<ImageProps, "src"> & { src: string | null | undefined; fallbackLabel?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "grid h-full w-full place-items-center bg-[radial-gradient(120%_80%_at_30%_20%,oklch(var(--surface-3)),oklch(var(--surface)))] text-muted-foreground",
          className,
        )}
      >
        {fallbackLabel ? (
          <span className="text-2xl font-medium tracking-tight">{initials(fallbackLabel)}</span>
        ) : null}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
