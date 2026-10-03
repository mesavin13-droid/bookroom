"use client";

import * as React from "react";
import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AccountLink() {
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e: string, session: unknown) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <Link
      href={signedIn ? "/account" : "/login?next=/account"}
      aria-label={signedIn ? "Личный кабинет" : "Войти"}
      className="grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
    >
      <CircleUserRound className="size-5" />
    </Link>
  );
}
