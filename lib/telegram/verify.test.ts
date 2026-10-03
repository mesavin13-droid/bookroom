import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { telegramChatId, telegramSyntheticEmail, verifyTelegramInitData } from "./verify";

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
      user: JSON.stringify({ id, first_name: "Иван", last_name: "Петров", username: "ivan" }),
    });

    const user = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(id);
    expect(user!.name).toBe("Иван Петров");
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
      user: JSON.stringify({ id, first_name: "Иван" }),
    });
    const params = new URLSearchParams(initData);
    params.set("user", JSON.stringify({ id, first_name: "Админ" }));

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