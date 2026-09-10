import Link from "next/link";
import type { CSSProperties } from "react";

// BRAND (REDESIGN-V4 §2A/§2B). The mark is the double-check W: two checks that share the middle peak, one stroke weight,
// round caps and joins, drawn inline so it takes any color. The lockup is the mark plus "WiseDinner" in Plus Jakarta
// Sans 800, tracking -0.02em, mark height = cap height × 1.15 (Plus Jakarta's cap height is 0.7em, so the mark stands
// 0.805em tall), gap 10px at the header size. Always a component, never a raster.
//
// geometry: the reference's three filled strokes resolve to one 5-point polyline whose two V's are both checks
// (short down-stroke, long up-stroke); the source's gaps near the vertices are a stylistic break that the clean
// rebuild closes. stroke 11.2 on a 100-box (8.3% of the reference width), the same path in public/logo/*.svg.
export const MARK_PATHS = ["M9.5 32.3 30.3 62.4 50 26.8", "M50 26.8 69.7 62.4 90.5 32.3"] as const;
const VIEW = "0 21 100 48"; // the W with its caps, cropped tight: 100 wide, 48 tall

export function Mark({ className = "", strokeWidth = 11.2, style }: { className?: string; strokeWidth?: number; style?: CSSProperties }) {
  return (
    <svg viewBox={VIEW} aria-hidden="true" focusable="false" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const VARIANTS = {
  forest: { mark: "text-forest", text: "text-ink" }, // header, white surfaces
  white: { mark: "text-white", text: "text-white" }, // the forest band, dark surfaces
  emerald: { mark: "text-emerald", text: "text-ink" }, // light accent surfaces
} as const;

// size: the mark's height in px; the wordmark follows (mark = cap height × 1.15). thin: the header's slightly lighter
// stroke. href: render as a link (the header and footer) or a plain span (share card, OG card).
export function Lockup({ variant = "forest", size = 28, thin = false, href, className = "" }: { variant?: keyof typeof VARIANTS; size?: number; thin?: boolean; href?: string; className?: string }) {
  const v = VARIANTS[variant];
  const fontSize = size / 0.805;
  const inner = (
    <>
      <Mark className={`shrink-0 ${v.mark}`} strokeWidth={thin ? 10 : 11.2} style={{ height: "0.805em", width: "1.677em" }} />
      <span className={`font-display font-extrabold tracking-[-0.02em] ${v.text}`}>WiseDinner</span>
    </>
  );
  const cls = `inline-flex items-center gap-[0.29em] leading-none whitespace-nowrap ${href ? "min-h-11" : ""} ${className}`;
  return href ? (
    <Link href={href} aria-label="WiseDinner home" className={cls} style={{ fontSize }}>
      {inner}
    </Link>
  ) : (
    <span className={cls} style={{ fontSize }}>
      {inner}
    </span>
  );
}

// em-sized lockup for app surfaces (the share card): inherits font-size from the screen
export function LockupEm({ variant = "forest", className = "" }: { variant?: keyof typeof VARIANTS; className?: string }) {
  const v = VARIANTS[variant];
  return (
    <span className={`inline-flex items-center gap-[0.29em] leading-none whitespace-nowrap ${className}`}>
      <Mark className={`shrink-0 ${v.mark}`} style={{ height: "0.805em", width: "1.677em" }} />
      <span className={`font-display font-extrabold tracking-[-0.02em] ${v.text}`}>WiseDinner</span>
    </span>
  );
}
