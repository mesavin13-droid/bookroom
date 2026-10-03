"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "!bg-surface-2 !text-foreground !border !border-border !rounded-2xl !font-sans",
          description: "!text-muted-foreground",
          error: "!text-destructive",
          success: "!text-foreground",
        },
      }}
    />
  );
}
