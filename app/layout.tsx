import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { OfflineBanner } from "@/components/offline-banner";
import { BRAND, SITE_URL } from "@/lib/config";
import "./globals.css";

const sans = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name}: онлайн-запись`, template: `%s` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  openGraph: { siteName: BRAND.name, locale: "ru_RU", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={sans.variable}>
      <body className="min-h-dvh font-sans">
        <OfflineBanner />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
