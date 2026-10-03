import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Вход | ${BRAND.name}`, robots: { index: false } };

// Public bot id: it only identifies the widget, the token stays server-side.
const telegramClientId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;

export default function LoginPage() {
  return (
    <main className="container flex min-h-dvh flex-col py-6">
      <Script src="https://telegram.org/js/telegram-widget.js?22" strategy="afterInteractive" />
      <BrandMark />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <h1 className="text-4xl font-medium">Вход</h1>
        <p className="mt-3 text-muted-foreground">
          Через Telegram — в один клик. Либо кодом на почту или по SMS.
        </p>
        <div className="mt-10">
          <Suspense>
            <LoginForm telegramClientId={telegramClientId} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
