import { ImageResponse } from "next/og";
import { usd } from "@/data/fixtures";
import { loadWeek } from "@/lib/shared-week";
import { MARK_PATHS } from "@/app/lockup";

export const runtime = "edge";

// share-page OG (REDESIGN-V4 §2D register): the S3 card's numbers on white. lockup, the week's total and protein,
// the five dinners as tags (edge OG cannot reach next/image; photos are the page's job), one line of provenance.
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const w = await loadWeek(id);
  if (!w) return new Response("not found", { status: 404 });
  const [jakarta, inter] = await Promise.all([
    fetch(new URL("../../../og/jakarta-800.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("../../../og/inter-500.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  const t = w.totals;
  const dinners = w.days.map((d) => d.meals.find((m) => m.slot === "dinner")?.name ?? "").filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#ffffff", color: "#111111", padding: 56, fontFamily: "Jakarta" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 34, fontWeight: 800, letterSpacing: -0.7 }}>
            <svg width="58" height="28" viewBox="0 21 100 48" fill="none" stroke="#0B3D2E" strokeWidth="11.2" strokeLinecap="round" strokeLinejoin="round">
              {MARK_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            WiseDinner
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#6B6B6B", fontFamily: "Inter", fontWeight: 500 }}>A solved week</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, fontSize: 68, fontWeight: 800, letterSpacing: -1.5 }}>
            <span>{usd(t.est_total_usd)}</span>
            <span style={{ color: "#6B6B6B", fontSize: 40, fontFamily: "Inter", fontWeight: 500 }}>{t.protein_per_day_g}g of protein a day</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {dinners.map((d) => (
              <span key={d} style={{ display: "flex", padding: "10px 16px", borderRadius: 999, background: "#F5F5F7", fontSize: 22, fontFamily: "Inter", fontWeight: 500 }}>
                {d}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#0B3D2E", fontFamily: "Inter", fontWeight: 500 }}>
          <span>
            Five dinners, one {t.items}-item list, under budget by {usd(t.under_budget_by_usd)}
          </span>
          <span>wisedinner.com</span>
        </div>
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
