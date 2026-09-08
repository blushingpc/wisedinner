import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // REDESIGN-V4 §5C: every rendered photo width at 1x, 2x and 3x (thumbnails 56, share strip 64, cards 160) so
  // next/image serves an exact candidate for each DPR and nothing renders above its intrinsic size or soft at 3x
  images: { formats: ["image/avif", "image/webp"], imageSizes: [56, 64, 112, 128, 160, 168, 192, 320, 480], qualities: [75, 90] },
  devIndicators: false, // the store-shot export and design screenshots run against dev; the badge must not print
  // hero LCP: the 12KB stylesheet was the render-blocking request that landed last behind the fonts and preloads on
  // slow 4G (first paint 2.0s); inlined, first paint follows the document
  experimental: { inlineCss: true },
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
