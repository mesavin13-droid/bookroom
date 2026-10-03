/**
 * Product branding lives here. Renaming the product = changing this file
 * (plus the favicon in app/icon.svg).
 */
export const BRAND = {
  name: "BOOKROOM",
  shortName: "Bookroom",
  tagline: "Своё приложение для онлайн-записи: детейлинг, СТО, салоны",
  supportEmail: "support@bookroom.app",
} as const;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const ADMIN_STUDIO_COOKIE = "br_studio";

export const DEFAULT_TIMEZONE = "Europe/Moscow";
