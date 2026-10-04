import { describe, expect, it } from "vitest";
// `sign` is aliased: this file already has a local helper by that name.
import { constants, createHash, createHmac, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { telegramChatId, telegramStartParam, telegramSyntheticEmail, verifyTelegramIdToken, verifyTelegramInitData, verifyTelegramInitDataDetailed } from "./verify";

const BOT_TOKEN = "123456:TEST_TOKEN_FOR_UNIT_TESTS";

/** Mirrors how Telegram signs initData: HMAC-SHA256 keyed by SHA256(bot_token). */
function sign(fields: Record<string, string>, token = BOT_TOKEN) {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const params = new URLSearchParams(fields);
  params.set("hash", hash);
  return params.toString();
}

const freshAuthDate = () => Math.floor(Date.now() / 1000);

describe("verifyTelegramInitData", () => {
  it("accepts a correctly signed payload", () => {
    const id = 55512345;
    const initData = sign({
      auth_date: String(freshAuthDate()),
      id: String(id),
      user: JSON.stringify({ id, first_name: "РРІР°РЅ", last_name: "РџРµС‚СЂРѕРІ", username: "ivan" }),
    });

    const user = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(id);
    expect(user!.name).toBe("РРІР°РЅ РџРµС‚СЂРѕРІ");
    expect(user!.username).toBe("ivan");
  });

  it("rejects a payload signed with a different bot token", () => {
    const initData = sign(
      {
        auth_date: String(freshAuthDate()),
        id: "1",
        user: JSON.stringify({ id: 1, first_name: "A" }),
      },
      "999999:ANOTHER_TOKEN",
    );
    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("rejects a tampered user field (signature no longer matches)", () => {
    const id = 55512345;
    const initData = sign({
      auth_date: String(freshAuthDate()),
      id: String(id),
      user: JSON.stringify({ id, first_name: "РРІР°РЅ" }),
    });
    const params = new URLSearchParams(initData);
    params.set("user", JSON.stringify({ id, first_name: "РђРґРјРёРЅ" }));

    expect(verifyTelegramInitData(params.toString(), BOT_TOKEN)).toBeNull();
  });

  it("rejects a missing or empty hash", () => {
    expect(verifyTelegramInitData("auth_date=1&id=1", BOT_TOKEN)).toBeNull();
    expect(verifyTelegramInitData("", BOT_TOKEN)).toBeNull();
  });

  it("rejects a stale payload (replay window)", () => {
    const id = 1;
    const initData = sign({
      auth_date: String(freshAuthDate() - 60 * 60 * 5),
      id: String(id),
      user: JSON.stringify({ id, first_name: "A" }),
    });
    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("rejects a payload dated in the future", () => {
    const id = 1;
    const initData = sign({
      auth_date: String(freshAuthDate() + 60 * 60),
      id: String(id),
      user: JSON.stringify({ id, first_name: "A" }),
    });
    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("rejects a payload without a user field", () => {
    const initData = sign({ auth_date: String(freshAuthDate()), id: "1" });
    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("only trusts a phone that Telegram marks as verified", () => {
    const id = 7;
    const unverified = sign({
      auth_date: String(freshAuthDate()),
      id: String(id),
      user: JSON.stringify({ id, first_name: "A", phone_number: "+79991234567", phone_number_verified: false }),
    });
    expect(verifyTelegramInitData(unverified, BOT_TOKEN)!.phoneVerified).toBe(false);

    const verified = sign({
      auth_date: String(freshAuthDate()),
      id: String(id),
      user: JSON.stringify({ id, first_name: "A", phone_number: "+79991234567", phone_number_verified: true }),
    });
    const u = verifyTelegramInitData(verified, BOT_TOKEN);
    expect(u!.phoneVerified).toBe(true);
    expect(u!.phone).toBe("+79991234567");
  });
});

describe("telegramChatId", () => {
  it("extracts the chat id from Mini App initData", () => {
    expect(telegramChatId(`chat=${encodeURIComponent(JSON.stringify({ id: -100123, type: "channel" }))}`)).toBe("-100123");
  });

  it("returns null when there is no chat", () => {
    expect(telegramChatId("user=%7B%22id%22%3A1%7D")).toBeNull();
    expect(telegramChatId("chat=not-json")).toBeNull();
  });
});

describe("telegramSyntheticEmail", () => {
  it("builds a stable, non-deliverable address", () => {
    expect(telegramSyntheticEmail(55512345)).toBe("tg55512345@telegram.bookroom.invalid");
  });
});

describe("verifyTelegramIdToken", () => {
  const BOT_ID = "8822412364";

  function jwt(header: unknown, payload: unknown, signature = "sig") {
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b(header)}.${b(payload)}.${signature}`;
  }

  it("rejects a token that is not a JWT", async () => {
    expect(await verifyTelegramIdToken("garbage", BOT_ID)).toBeNull();
  });

  it("rejects a wrong issuer", async () => {
    const token = jwt({ alg: "RS256", kid: "oidc-1" }, { iss: "https://evil.example", aud: BOT_ID, sub: "1", exp: 9999999999 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects a token issued for another bot", async () => {
    const token = jwt({ alg: "RS256", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: "42", sub: "1", exp: 9999999999 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = jwt({ alg: "RS256", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: BOT_ID, sub: "1", exp: 1 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects a non-RS256 algorithm (no algorithm downgrade)", async () => {
    const token = jwt({ alg: "none", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: BOT_ID, sub: "1", exp: 9999999999 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects alg=none even when a kid is present", async () => {
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const payload = { iss: "https://oauth.telegram.org", aud: BOT_ID, sub: "1", exp: 9999999999 };
    const token = `${b({ alg: "none", kid: "oidc-1" })}.${b(payload)}.`;
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects a symmetric algorithm (HS256) we cannot verify safely", async () => {
    const token = jwt({ alg: "HS256", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: BOT_ID, sub: "1", exp: 9999999999 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects an unknown kid", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const signing = `${b({ alg: "RS256", kid: "attacker-key" })}.${b({
      iss: "https://oauth.telegram.org",
      aud: BOT_ID,
      sub: "1",
      exp: 9999999999,
    })}`;
    const token = `${signing}.${cryptoSign("RSA-SHA256", Buffer.from(signing), privateKey).toString("base64url")}`;
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("refuses to use the RSA key for an ECDSA algorithm (kty mismatch)", async () => {
    // oidc-1 is Telegram's RSA key. Claiming ES256 with that kid must not
    // borrow it, otherwise key/algorithm confusion becomes possible.
    const token = jwt({ alg: "ES256", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: BOT_ID, sub: "1", exp: 9999999999 }, "sig");
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects a token signed by an unrelated RSA key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const signing = `${b({ alg: "RS256", kid: "oidc-1" })}.${b({
      iss: "https://oauth.telegram.org",
      aud: BOT_ID,
      sub: "1",
      exp: 9999999999,
    })}`;
    const token = `${signing}.${cryptoSign("RSA-SHA256", Buffer.from(signing), privateKey).toString("base64url")}`;
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = jwt({ alg: "RS256", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: BOT_ID, sub: "1", exp: 1000 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("rejects a token minted for a different bot", async () => {
    const token = jwt({ alg: "RS256", kid: "oidc-1" }, { iss: "https://oauth.telegram.org", aud: "1111111111", sub: "1", exp: 9999999999 });
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });

  it("keeps PS256 verification strict (no PKCS#1 downgrade)", async () => {
    // A PS256 header with a PKCS#1 v1.5 signature must not be accepted.
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const signing = `${b({ alg: "PS256", kid: "oidc-1" })}.${b({
      iss: "https://oauth.telegram.org",
      aud: BOT_ID,
      sub: "1",
      exp: 9999999999,
    })}`;
    const v15 = cryptoSign("sha256", Buffer.from(signing), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    });
    const token = `${signing}.${v15.toString("base64url")}`;
    expect(await verifyTelegramIdToken(token, BOT_ID)).toBeNull();
  });
});

describe("verifyTelegramInitDataDetailed", () => {
  const base = { auth_date: String(freshAuthDate()), user: JSON.stringify({ id: 7, first_name: "A" }) };

  it("accepts a fresh, correctly signed payload", () => {
    const r = verifyTelegramInitDataDetailed(sign({ ...base }), BOT_TOKEN);
    expect(r.ok).toBe(true);
  });

  it("reports 'expired' for a stale payload (cached WebView)", () => {
    const old = String(Math.floor(Date.now() / 1000) - 7200);
    const r = verifyTelegramInitDataDetailed(sign({ ...base, auth_date: old }), BOT_TOKEN);
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("reports 'bad_signature' when the token does not match", () => {
    const r = verifyTelegramInitDataDetailed(sign({ ...base }), "999999:OTHER");
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("reports 'missing_hash' when the signature is absent", () => {
    expect(verifyTelegramInitDataDetailed(`auth_date=${freshAuthDate()}`, BOT_TOKEN)).toEqual({
      ok: false,
      reason: "missing_hash",
    });
  });

  it("reports 'missing_user' when the user blob is absent", () => {
    const r = verifyTelegramInitDataDetailed(sign({ auth_date: base.auth_date }), BOT_TOKEN);
    expect(r).toEqual({ ok: false, reason: "missing_user" });
  });

  it("keeps the simple API in sync with the detailed one", () => {
    const ok = verifyTelegramInitData(sign({ ...base }), BOT_TOKEN);
    expect(ok?.id).toBe(7);
    const old = String(Math.floor(Date.now() / 1000) - 7200);
    expect(verifyTelegramInitData(sign({ ...base, auth_date: old }), BOT_TOKEN)).toBeNull();
  });
});

describe("telegramStartParam", () => {
  it("returns the value passed through ?startapp=", () => {
    expect(telegramStartParam("start_param=6f1c0f1e-1111-4222-8333-444455556666")).toBe(
      "6f1c0f1e-1111-4222-8333-444455556666",
    );
  });

  it("is null when the app was opened without a start link", () => {
    expect(telegramStartParam("auth_date=1&user=%7B%7D")).toBeNull();
  });

  it("treats an empty value as absent", () => {
    expect(telegramStartParam("start_param=")).toBeNull();
    expect(telegramStartParam("start_param=%20%20")).toBeNull();
  });

  it("does not throw on garbage input", () => {
    expect(telegramStartParam("")).toBeNull();
  });
});