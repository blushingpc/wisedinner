import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  devIndicators: false, // the store-shot export and design screenshots run against dev; the badge must not print
  async redirects() {
    // the printed short link (hero QR, WD-07): repoint here, never reprint. temporary (307) on purpose.
    return [
      { source: "/ios", destination: process.env.NEXT_PUBLIC_APP_STORE_URL || "/", permanent: false },
      // the pre-sale success page shipped for one day (2026-09-05) and was withdrawn the same day; anyone holding the link lands on the waitlist thanks page
      { source: "/founders", destination: "/thanks", statusCode: 301 },
      // the web demo was removed in REDESIGN-V3 (2026-09-07): the site never runs the solver for a visitor
      { source: "/start", destination: "/", statusCode: 301 },
      { source: "/plan", destination: "/", statusCode: 301 },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
