import type { NextConfig } from "next";
// API-only Node artifact. Website shell/media and support scheduler stay separate.
const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/v1/current/*": ["./lib/generated-current-source-capsule-*.json"] },
  async headers() { return [{source:"/(.*)",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"X-Frame-Options",value:"DENY"}
  ]}]; }
};
export default nextConfig;
