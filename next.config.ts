import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

/**
 * Builds the CSP.
 *
 * `frameAncestors` is the only part that differs per route: Telegram embeds the
 * Mini App in an iframe from web.telegram.org, and Chromium reports a blocked
 * frame as "site refused to connect". Everything else stays locked down.
 */
function buildCsp(frameAncestors: string) {
  return [
    "default-src 'self'",
    // api.telegram.org is only used server-side, but is allowed here because
    // Next.js may inline prefetches.
    `script-src 'self' 'unsafe-inline' https://telegram.org${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:" + (isDev ? " http://127.0.0.1:54321 http://localhost:54321" : ""),
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://api.telegram.org${isDev ? " ws: http://127.0.0.1:54321 http://localhost:54321" : ""}`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
    // The OIDC consent screen is framed; nothing else is.
    "frame-src https://oauth.telegram.org",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const csp = buildCsp("'none'");
// Telegram's clients render a Mini App inside a frame hosted by web.telegram.org,
// so this route must be framable by them and by nothing else.
const tgCsp = buildCsp("'self' https://web.telegram.org https://*.telegram.org");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/object/public/**" },
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        // Everything except the Telegram Mini App: no framing at all.
        source: "/((?!tg$).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
      {
        // Mini App: Telegram frames it from web.telegram.org. Sending DENY here
        // makes the client show "site refused to connect" instead of the app.
        source: "/tg",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: tgCsp },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Private booking links: never cached, never leaked via Referer.
        source: "/s/:slug/booking/:token*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/(admin|platform|account)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
