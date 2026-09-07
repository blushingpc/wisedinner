import { ImageResponse } from "next/og";
import { fixtures, usd } from "@/data/fixtures";

export const runtime = "edge";

// share-page OG (REDESIGN-V3 §5): the S3 card's numbers on paper — lockup, "$49.20 · 152g/day · ✓✓✓", the five dinners
// as text (edge OG can't reach next/image; photos are the page's job), one line of provenance. Static per fixture id.
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const w = fixtures[id];
  if (!w) return new Response("not found", { status: 404 });
  const [bricolage, plexMono] = await Promise.all([
    fetch(new URL("../../../og/bricolage-800.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("../../../og/plex-mono-600.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  const t = w.totals;
  const dinners = w.days.map((d) => d.meals.find((m) => m.slot === "dinner")?.name ?? "").filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#faf7f0", color: "#191817", padding: 64, fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 800 }}>
            <svg width="28" height="28" viewBox="430 775 490 490">
              <path fill="#191817" d="M 866.748 797.123 C 888.672 796.764 902.351 814.295 895.542 833.808 L 742.788 1148.45 C 691.385 1252.91 660.131 1255.7 644.346 1234.17 L 478.224 885.609 C 470.231 869.087 449.917 834.522 453.826 817.99 C 472.56 797.741 480.571 796.727 488.007 798.915 L 673.027 1169.7 L 844.471 816.158 C 850.961 804.254 853.896 800.88 866.748 797.123 z" />
            </svg>
            wisedinner
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#4e4b45" }}>a solved week</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontFamily: "PlexMono", fontSize: 64, fontWeight: 600, letterSpacing: -2 }}>
            {usd(t.est_total_usd)} · {t.protein_per_day_g}g/day · <span style={{ color: "#173f2e", marginLeft: 12 }}>✓✓✓</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {dinners.map((d) => (
              <span key={d} style={{ display: "flex", padding: "10px 16px", borderRadius: 999, background: "#f3f0e8", fontSize: 22, fontWeight: 800 }}>
                {d}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#173f2e", fontWeight: 800 }}>
          <span>five dinners · one {t.items}-item list · under budget by {usd(t.under_budget_by_usd)}</span>
          <span>wisedinner.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Bricolage", data: bricolage, weight: 800 },
        { name: "PlexMono", data: plexMono, weight: 600 },
      ],
    },
  );
}
