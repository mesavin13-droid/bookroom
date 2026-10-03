import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Вход | ${BRAND.name}`, robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="container flex min-h-dvh flex-col py-6">
      <BrandMark />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <h1 className="text-4xl font-medium">Вход</h1>
        <p className="mt-3 text-muted-foreground">Без пароля: пришлём код на почту или по SMS.</p>
        <div className="mt-10">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
