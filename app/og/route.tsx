import { ImageResponse } from "next/og";
import { proof } from "@/content/site";

export const runtime = "edge";

// A6 (DESIGN-AUDIT §13): composed OG — A2 crop left two-thirds, lowercase headline in real
// Bricolage 800 on paper, one yolk shelf-tag, small wordmark. fonts + crop are committed assets.
const COPY: Record<string, [string, string]> = {
  home: ["hit your protein.", "spend way less."],
  drop: ["this week's protein plan.", "refreshed every sunday."],
  pricing: ["$4.99/mo billed yearly.", "nothing for sale yet."],
};

export async function GET(req: Request) {
  const page = new URL(req.url).searchParams.get("page") ?? "home";
  const [l1, l2] = COPY[page] ?? COPY.home;
  // new URL(...) literals inline — Next only bundles the asset when it can see the exact call
  const [bricolage, plexMono, a2] = await Promise.all([
    fetch(new URL("./bricolage-800.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./plex-mono-600.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./a2-og.jpg", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fbfaf6", color: "#1b1a18", fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", position: "relative", width: 800, height: 630 }}>
          {/* @ts-expect-error satori accepts an ArrayBuffer src */}
          <img src={a2} width={800} height={630} />
          {page !== "pricing" && proof.avgWeekUsd > 0 && (
            <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "absolute",
              right: 36,
              bottom: 40,
              background: "#f5b800",
              color: "#1b1a18",
              padding: "14px 22px",
              borderRadius: 4,
              transform: "rotate(-2deg)",
              boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
              fontFamily: "PlexMono",
            }}
          >
              <span style={{ fontSize: 40, fontWeight: 600 }}>${proof.avgWeekUsd.toFixed(2)}</span>
              <span style={{ fontSize: 18 }}>/ week</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "44px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 28, fontWeight: 800 }}>
            <svg width="26" height="26" viewBox="430 775 490 490">
              <path
                fill="#1b1a18"
                d="M 866.748 797.123 C 888.672 796.764 902.351 814.295 895.542 833.808 L 742.788 1148.45 C 691.385 1252.91 660.131 1255.7 644.346 1234.17 L 478.224 885.609 C 470.231 869.087 449.917 834.522 453.826 817.99 C 472.56 797.741 480.571 796.727 488.007 798.915 L 673.027 1169.7 L 844.471 816.158 C 850.961 804.254 853.896 800.88 866.748 797.123 z"
              />
            </svg>
            wisedinner
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 58, fontWeight: 800, letterSpacing: -2, lineHeight: 1.02 }}>
            <span>{l1}</span>
            <span style={{ color: "#4e4b45" }}>{l2}</span>
          </div>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 800, color: "#173f2e" }}>pre-order on the App Store</div>
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
