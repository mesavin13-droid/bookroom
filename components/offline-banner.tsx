"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-toast flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-primary-foreground animate-in slide-in-from-top"
    >
      <WifiOff className="size-4" aria-hidden />
      Нет интернета. Мы продолжим, как только связь вернётся.
    </div>
  );
}
