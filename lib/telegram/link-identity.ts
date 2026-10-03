import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramSyntheticEmail } from "@/lib/telegram/verify";
import { humanizeError } from "@/lib/booking/errors";
import type { TelegramUser } from "@/lib/telegram/verify";

export type LinkResult =
  | { ok: true; tokenHash: string }
  | { ok: false; reason: string; error: string };

/**
 * Finds or creates the account behind a verified Telegram identity and attaches
 * the Telegram id to it.
 *
 * Supabase Auth cannot consume Telegram's OIDC directly (its JWKS holds a
 * secp256k1 key that gotrue's verifier rejects), so the session is minted
 * here: a one-time token hash the client or callback exchanges for a session.
 *
 * The Telegram id is claimed only when free. If it already belongs to a
 * different profile we refuse, so nobody can take over an account by
 * authenticating with a stranger's Telegram identity.
 */
export async function linkTelegramIdentity(tg: TelegramUser): Promise<LinkResult> {
  const admin = createAdminClient();
  const email = telegramSyntheticEmail(tg.id);

  // 1. Existing account: by Telegram id first, then by the synthetic email
  //    (covers accounts created before Telegram was connected).
  const { data: byTg } = await admin.from("profiles").select("id").eq("telegram_user_id", tg.id).maybeSingle();
  let userId: string | undefined = byTg?.id;

  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = list?.users?.find((u) => u.email === email);
    if (match) {
      userId = match.id;
      // Confirmed so the account works without an email round-trip.
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
      if (!match) return { ok: false, reason: "create_failed", error: humanizeError(error) };
      userId = match.id;
    } else {
      userId = data.user?.id;
    }
  }

  if (!userId) return { ok: false, reason: "create_failed", error: "Не удалось создать аккаунт." };

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
    const taken = /TELEGRAM_IN_USE/.test(claimError.message);
    return {
      ok: false,
      reason: taken ? "telegram_in_use" : "claim_failed",
      error: taken
        ? "Этот Telegram уже привязан к другому аккаунту."
        : humanizeError(claimError),
    };
  }

  // 4. Mint a one-time magic link and return only its hash.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return { ok: false, reason: "link_failed", error: linkError ? humanizeError(linkError) : "Не удалось создать сессию." };
  }

  return { ok: true, tokenHash };
}