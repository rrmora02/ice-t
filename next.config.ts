import type { NextConfig } from "next";

// El navegador habla directo con Supabase (auth, PostgREST y realtime),
// así que el origen del proyecto tiene que estar permitido explícitamente
// en connect-src. Se lee de la misma variable que usa la app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^https:/, "wss:") : "";

const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // Next.js inyecta scripts inline para hidratación; en desarrollo además
  // necesita eval para el refresh rápido. Sin nonces por request no se
  // puede endurecer más sin romper el App Router.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind y los estilos en línea de Next requieren unsafe-inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [`connect-src 'self'`, supabaseOrigin, supabaseWs].filter(Boolean).join(" "),
  "worker-src 'self'",
  "manifest-src 'self'",
  // Nada de esta app se embebe ni embebe a terceros.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Redundante con frame-ancestors, pero lo entienden navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La PWA no usa cámara, micrófono ni ubicación.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
