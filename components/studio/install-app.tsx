"use client";

import * as React from "react";
import { ArrowRight, Download, Share } from "lucide-react";
import { toast } from "sonner";
import { GlowPanel } from "@/components/studio/glow-panel";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** "Добавить на экран": real PWA install on Android/desktop Chrome, instructions on iOS. Hidden once installed. */
export function InstallCard({ name, logo }: { name: string; logo: React.ReactNode }) {
  const [evt, setEvt] = React.useState<BIPEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [ios, setIos] = React.useState(false);
  const [showIos, setShowIos] = React.useState(false);

  React.useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (evt) {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setEvt(null);
      return;
    }
    if (ios) return setShowIos(true);
    toast("Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».");
  }

  return (
    <GlowPanel className="p-7 md:p-10">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">{logo}</span>
        <div>
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-[0.9375rem] text-muted-foreground">Приложение студии</p>
        </div>
      </div>
      <h2 className="mt-7 text-[2.125rem] font-semibold md:text-5xl">Студия всегда под рукой.</h2>
      <p className="mt-3 max-w-md text-[1.0625rem] text-muted-foreground">Записывайтесь за несколько касаний, без поиска ссылки и звонков.</p>
      <button
        type="button"
        onClick={install}
        className="mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-primary font-semibold text-primary-foreground transition-transform active:scale-[0.98] md:w-auto md:px-10"
      >
        <Download className="size-5" /> Добавить на экран <ArrowRight className="size-5" />
      </button>
      {showIos ? (
        <p className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted-foreground animate-in fade-in">
          Нажмите <Share className="size-4 text-foreground" aria-label="Поделиться" /> внизу Safari, затем «На экран Домой».
        </p>
      ) : (
        <p className="mt-5 text-sm text-subtle">Бесплатно. Установка через браузер.</p>
      )}
    </GlowPanel>
  );
}
