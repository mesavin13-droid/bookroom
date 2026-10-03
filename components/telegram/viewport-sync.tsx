"use client";

import * as React from "react";

/**
 * Applies Telegram's theme to the document and keeps the viewport in sync with
 * the Mini App container.
 *
 * Telegram exposes its palette as CSS variables; mapping them onto the app
 * tokens makes the embedded view look native without a second stylesheet.
 */
export function TelegramViewportSync() {
  React.useEffect(() => {
    const w = window as Window & { Telegram?: { WebApp?: Record<string, unknown> } };
    const wa = w.Telegram?.WebApp;
    if (!wa) return;

    type Expandable = {
      ready?: () => void;
      expand?: () => void;
      disableVerticalSwipes?: () => void;
      setHeaderColor?: (c: string) => void;
      setBackgroundColor?: (c: string) => void;
      themeParams?: Record<string, string>;
      colorScheme?: string;
      viewportHeight?: number;
      onEvent?: (e: string, cb: () => void) => void;
      offEvent?: (e: string, cb: () => void) => void;
    };
    const app = wa as Expandable;

    app.ready?.();
    app.expand?.();
    // Stops the page from scrolling while the user swipes between views.
    app.disableVerticalSwipes?.();

    const theme = app.themeParams;
    if (theme) {
      const root = document.documentElement;
      const map: Record<string, string> = {
        bg_color: "--tg-bg",
        text_color: "--tg-text",
        hint_color: "--tg-hint",
        link_color: "--tg-link",
        button_color: "--tg-button",
        button_text_color: "--tg-button-text",
        secondary_bg_color: "--tg-secondary-bg",
      };
      for (const [k, cssVar] of Object.entries(map)) {
        const v = theme[k];
        if (v) root.style.setProperty(cssVar, v);
      }
      document.documentElement.dataset.tgTheme = app.colorScheme ?? "light";
    }

    // Track the dynamic viewport height (Telegram resizes for the keyboard).
    const applyHeight = () => {
      const h = typeof app.viewportHeight === "number" ? app.viewportHeight : window.innerHeight;
      document.documentElement.style.setProperty("--tg-viewport-height", `${h}px`);
    };
    applyHeight();
    app.onEvent?.("viewportChanged", applyHeight);

    return () => {
      app.offEvent?.("viewportChanged", applyHeight);
    };
  }, []);

  return null;
}