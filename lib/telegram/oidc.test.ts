import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  buildAuthorizeUrl,
  clientId,
  createPkce,
  randomState,
  redirectUri,
} from "@/lib/telegram/oidc";

const BOT_ID = "8822412364";

describe("telegram oidc", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID = BOT_ID;
    process.env.TELEGRAM_LOGIN_CLIENT_SECRET = "secret";
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;
    delete process.env.TELEGRAM_LOGIN_CLIENT_SECRET;
  });

  describe("createPkce", () => {
    it("produces an S256 challenge matching the verifier", () => {
      const { verifier, challenge } = createPkce();
      const expected = createHash("sha256").update(verifier).digest("base64url");
      expect(challenge).toBe(expected);
    });

    it("matches the RFC 7636 appendix B test vector", () => {
      // Known-good pair; guards against a subtle base64url/encoding mistake.
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
      expect(createHash("sha256").update(verifier).digest("base64url")).toBe(expected);
    });

    it("generates a unique verifier each time", () => {
      expect(createPkce().verifier).not.toBe(createPkce().verifier);
    });

    it("stays within the RFC 7636 length range (43-128 chars)", () => {
      const { verifier } = createPkce();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });
  });

  describe("randomState", () => {
    it("returns distinct, non-empty values", () => {
      const a = randomState();
      expect(a).toBeTruthy();
      expect(a).not.toBe(randomState());
    });
  });

  describe("redirectUri", () => {
    it("builds the callback path", () => {
      expect(redirectUri("https://bookroom.example.com")).toBe(
        "https://bookroom.example.com/auth/telegram/callback",
      );
    });

    it("does not produce a double slash when the site url has a trailing one", () => {
      expect(redirectUri("https://bookroom.example.com/")).toBe(
        "https://bookroom.example.com/auth/telegram/callback",
      );
    });
  });

  describe("buildAuthorizeUrl", () => {
    const url = () => buildAuthorizeUrl({ siteUrl: "https://x.dev", state: "st", challenge: "ch" });

    it("targets the Telegram authorization endpoint", () => {
      expect(url().startsWith("https://oauth.telegram.org/auth?")).toBe(true);
    });

    it("uses the authorization code flow with PKCE", () => {
      const p = new URL(url()).searchParams;
      expect(p.get("client_id")).toBe(BOT_ID);
      expect(p.get("response_type")).toBe("code");
      expect(p.get("code_challenge")).toBe("ch");
      expect(p.get("code_challenge_method")).toBe("S256");
      expect(p.get("state")).toBe("st");
    });

    it("requests the phone scope so no SMS provider is needed", () => {
      const scope = new URL(url()).searchParams.get("scope") ?? "";
      expect(scope.split(" ")).toEqual(expect.arrayContaining(["openid", "profile", "phone"]));
    });

    it("carries the return path so login can resume", () => {
      const u = buildAuthorizeUrl({ siteUrl: "https://x.dev", state: "s", challenge: "c", next: "/account" });
      expect(new URL(u).searchParams.get("next")).toBe("/account");
    });

    it("omits next when it is not provided", () => {
      expect(new URL(url()).searchParams.get("next")).toBeNull();
    });

    it("throws a clear error when the bot id is missing", () => {
      delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;
      expect(() => clientId()).toThrow(/NEXT_PUBLIC_TELEGRAM_BOT_ID/);
    });
  });
});
