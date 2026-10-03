import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramSyntheticEmail, verifyTelegramInitData } from "@/lib/telegram/verify";
import { humanizeError } from "@/lib/booking/errors";

export type TelegramLoginResult =
  | { ok: true; tokenHash: string }
  | { ok: false; error: string; code?: string };

/**
 * Exchanges verified Telegram identity for a Supabase session.
 *
 * Supabase Auth cannot consume Telegram's OIDC directly (its JWKS uses
 * secp256k1, which gotrue does not support), so we mint the session here:
 * find or create the auth user, link the Telegram id, then hand the browser a
 * one-time token hash it can exchange client-side.
 */
export async function loginWithTelegram(initData: string): Promise<TelegramLoginResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "Вход по Telegram пока не настроен." };

  const tg = verifyTelegramInitData(initData, botToken);
  if (!tg) return { ok: false, error: "Данные Telegram не прошли проверку. Попробуйте ещё раз." };

  const admin = createAdminClient();
  const email = telegramSyntheticEmail(tg.id);

  // 1. Look for an existing account: by Telegram id first, then by the
  //    synthetic email (covers accounts created before Telegram was connected).
  const { data: byTg } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_user_id", tg.id)
    .maybeSingle();

  let userId: string | undefined = byTg?.id;

  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = list?.users?.find((u) => u.email === email);
    if (match) {
      userId = match.id;
      // Confirmed so the account is usable without an email round-trip.
      if (!match.email_confirmed_at) {
        await admin.auth.admin.updateUserById(match.id, { email_confirm: true });
      }
    }
  }

  // 2. Create the account if this Telegram identity is new.
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: tg.name,
        telegram_username: tg.username,
        telegram_id: tg.id,
        provider: "telegram",
      },
    });
    if (error) {
      // A concurrent request may have created the same user a moment ago.
      const { data: retry } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = retry?.users?.find((u) => u.email === email);
      if (!match) return { ok: false, error: humanizeError(error) };
      userId = match.id;
    } else {
      userId = data.user?.id;
    }
  }

  if (!userId) return { ok: false, error: "Не удалось создать аккаунт." };

  // 3. Attach the Telegram identity. Refuses if that id belongs to someone else.
  const phone = tg.phoneVerified && tg.phone ? tg.phone : null;
  const { error: claimError } = await admin.rpc("claim_telegram_identity", {
    p_profile_id: userId,
    p_telegram_id: tg.id,
    p_username: tg.username ?? "",
    p_name: tg.name ?? "",
    p_phone: phone ?? "",
  });
  if (claimError) {
    const code = /TELEGRAM_IN_USE/.test(claimError.message) ? "TELEGRAM_IN_USE" : undefined;
    return {
      ok: false,
      code,
      error: /TELEGRAM_IN_USE/.test(claimError.message)
        ? "Этот Telegram уже привязан к другому аккаунту."
        : humanizeError(claimError),
    };
  }

  // 4. Mint a one-time magic link and return only its hash.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return { ok: false, error: linkError ? humanizeError(linkError) : "Не удалось создать сессию." };
  }

  return { ok: true, tokenHash };
}