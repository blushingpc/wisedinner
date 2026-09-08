import { ImageResponse } from "next/og";
import { site } from "@/content/site";
import { MARK_PATHS } from "@/app/lockup";

export const runtime = "edge";

// runtime OG for the secondary pages (?page=drop|pricing). the homepage card is public/og/home.png, composed from the
// real components by scripts/og-card.ts (satori cannot render the phone). REDESIGN-V4 §2D register: white field,
// lockup top-left, Plus Jakarta 800 headline, Inter 500 sub, nothing else.
const COPY: Record<string, [string, string]> = {
  home: ["Hit your protein. Spend way less.", site.hero.lede],
  drop: ["This week's protein plan.", "Refreshed every Sunday from real shelf prices."],
  pricing: ["Simple pricing.", `Protein Plan from $${site.pricing.tiers[0].perMonth.toFixed(2)} a month billed yearly. 14-day free trial in the app.`],
};

export async function GET(req: Request) {
  const page = new URL(req.url).searchParams.get("page") ?? "home";
  const [h1, sub] = COPY[page] ?? COPY.home;
  const [jakarta, inter] = await Promise.all([
    fetch(new URL("./jakarta-800.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./inter-500.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#ffffff", color: "#111111", padding: 40, fontFamily: "Jakarta" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 34, fontWeight: 800, letterSpacing: -0.7 }}>
          <svg width="58" height="28" viewBox="0 21 100 48" fill="none" stroke="#0B3D2E" strokeWidth="11.2" strokeLinecap="round" strokeLinejoin="round">
            {MARK_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          WiseDinner
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>{h1}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 28, lineHeight: 1.4, color: "#6B6B6B", fontFamily: "Inter", fontWeight: 500 }}>{sub}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, fontFamily: "Inter", fontWeight: 500, color: "#0B3D2E" }}>wisedinner.com</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Jakarta", data: jakarta, weight: 800 },
        { name: "Inter", data: inter, weight: 500 },
      ],
    },
  );
}
