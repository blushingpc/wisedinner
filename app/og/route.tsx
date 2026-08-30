import { ImageResponse } from "next/og";
import { drop } from "@/data/drop";

export const runtime = "edge";

const COPY: Record<string, [string, string]> = {
  home: ["hit your protein.", "spend way less."],
  drop: ["this week's protein plan.", "refreshed every sunday."],
  pricing: ["$4.99/mo billed yearly.", "nothing for sale yet."],
};

// 1200×630: type left, a mini receipt right. numbers from the committed fixture, labeled est. in-store.
export function GET(req: Request) {
  const page = new URL(req.url).searchParams.get("page") ?? "home";
  const [l1, l2] = COPY[page] ?? COPY.home;
  const rows = drop.list.slice(0, 4);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", color: "#191817", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, fontWeight: 700 }}>
            <svg width="40" height="40" viewBox="0 0 2048 2048">
              <path fill="#191817" d="M 866.748 797.123 C 888.672 796.764 902.351 814.295 895.542 833.808 L 742.788 1148.45 C 691.385 1252.91 660.131 1255.7 644.346 1234.17 L 478.224 885.609 C 470.231 869.087 449.917 834.522 453.826 817.99 C 472.56 797.741 480.571 796.727 488.007 798.915 L 673.027 1169.7 L 844.471 816.158 C 850.961 804.254 853.896 800.88 866.748 797.123 z" />
            </svg>
            wisedinner
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            <span>{l1}</span>
            <span style={{ color: "#6B675F" }}>{l2}</span>
          </div>
          <div style={{ fontSize: 22, color: "#6B675F", letterSpacing: 3 }}>PROTEIN, SOLVED LIKE MATH · WISEDINNER.COM</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 380, background: "#FAF8F3", padding: 32, fontFamily: "monospace", fontSize: 20, boxShadow: "0 8px 30px rgba(25,24,23,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "center", letterSpacing: 3, fontSize: 16 }}>WISEDINNER</div>
          <div style={{ display: "flex", justifyContent: "center", color: "#6B675F", marginBottom: 20 }}>one week, solved</div>
          {rows.map((i) => (
            <div key={i.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", textTransform: "uppercase" }}>
              <span>{i.name.slice(0, 20)}</span>
              <span>${i.price_usd.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: "2px dashed #E9E7E2", margin: "20px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14, letterSpacing: 2 }}>EST. IN-STORE</span>
            <span style={{ fontSize: 40, color: "#C33D2E", fontWeight: 700 }}>${drop.est_total.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>PROTEIN / DAY</span>
            <span style={{ color: "#1D7A46" }}>{drop.protein_per_day} g</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
