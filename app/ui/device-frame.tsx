import { preload } from "react-dom";

// DeviceFrame: Apple's official iPhone 17 bezel (Black, Apple Design Resources; the 17 Pro ships in no black, and the
// 17 Black measures pixel-identical to the 16 Pro) composited OVER a real React screen. The CSS-drawn bezel is gone.
//
// geometry measured off the PNG (1350×2760): screen hole at (72,69) 1206×2622 → left 5.333% top 2.5% w 89.333% h 95%;
// screen corner radius ≈190px on 1206 → 15.75% / 7.25%; body 1296×2708 at (27,26) with ≈240px corners; the dynamic
// island is opaque in the PNG (x 488–861, y 112–219) so it sits over the screen for free.
//
// the bezel is a static AVIF/WebP ladder (scripts/gen-bezel.ts) at every rendered width × 1, 2, 3, chosen by `sizes`,
// with the PNG as the fallback. the hero frame (priority) gets fetchpriority=high and a preload link, so the LCP image
// is one exact static file and never an on-demand transform.
//
// sizing: the frame is a CSS container; the screen sets --pt = one iPhone point (390pt design width), and screens
// size in em off a 16pt font-size, so one component renders identically at 240px, 300px or 430px wide.
// children are REAL components, never screenshots. no transform: scale; zero CLS.
export const BEZEL = { w: 1350, h: 2760 } as const;
const WIDTHS = [181, 205, 256, 260, 290, 300, 340, 362, 410, 512, 520, 543, 580, 600, 615, 680, 768, 780, 870, 900, 1000, 1020] as const;
const srcset = (ext: string) => WIDTHS.map((w) => `/img/bezel/iphone-17-black-${w}.${ext} ${w}w`).join(", ");
const AVIF = srcset("avif");
const WEBP = srcset("webp");

export function DeviceFrame({
  children,
  className = "",
  label,
  tilt,
  widthClass = "w-[320px]",
  chrome = true,
  priority = false,
  sizes = "(min-width: 1024px) 430px, 300px",
  ptClass = "",
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  tilt?: "left" | "right";
  widthClass?: string;
  chrome?: boolean; // true: draw the status bar + screen padding for legacy children; false: the child is a full screen (app/screens/*)
  priority?: boolean; // the hero frame: fetchpriority=high + a preload link for its bezel; every other frame is lazy
  sizes?: string; // the frame's rendered CSS width per breakpoint; drives which ladder file the browser picks
  ptClass?: string; // a .pt-* class from globals.css that states --pt in viewport units (first-paint fast path); cqw otherwise
}) {
  if (priority) preload("/img/bezel/iphone-17-black.png", { as: "image", imageSrcSet: AVIF, imageSizes: sizes, type: "image/avif", fetchPriority: "high" });
  const persp = tilt === "left" ? "lg:[transform:perspective(1100px)_rotateY(-10deg)_rotateX(1.5deg)]" : tilt === "right" ? "lg:[transform:perspective(1100px)_rotateY(7deg)_rotateX(1deg)]" : "";
  const shadow = tilt === "left" ? "frame-shadow-left" : tilt === "right" ? "frame-shadow-right" : "frame-shadow";
  return (
    <div role="img" aria-label={label} className={`@container relative aspect-[1350/2760] shrink-0 ${widthClass} ${persp} ${className}`}>
      {/* the one ambient shadow shaped to the body: the PNG's corners are transparent, so a box shadow on the root would print a rectangle */}
      <div aria-hidden="true" className={`absolute rounded-[19.3%/9.6%] bg-ink ${shadow}`} style={{ left: "2.07%", top: "0.9%", width: "95.85%", height: "98.2%" }} />
      <div className={`screen ${ptClass} absolute overflow-hidden bg-white text-ink`} style={{ left: "5.333%", top: "2.5%", width: "89.333%", height: "95%", borderRadius: "15.75% / 7.25%" }}>
        {chrome ? (
          <>
            <StatusBar />
            <div className="absolute inset-x-0 top-[9.5%] bottom-0 overflow-hidden px-[1.25em]">{children}</div>
          </>
        ) : (
          children
        )}
        {/* diagonal glare, ~6% white */}
        <div aria-hidden="true" className="frame-glare pointer-events-none absolute inset-0" />
      </div>
      <picture>
        <source type="image/avif" srcSet={AVIF} sizes={sizes} />
        <source type="image/webp" srcSet={WEBP} sizes={sizes} />
        <img src="/img/bezel/iphone-17-black.png" alt="" aria-hidden="true" width={BEZEL.w} height={BEZEL.h} decoding={priority ? "sync" : "async"} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      </picture>
    </div>
  );
}

// iOS status bar: 9:41 left of the island, signal/wifi/battery right. positioned in screen space beside the island
// (island rows 112–219 of the PNG → 1.6%–5.7% of the screen height).
export function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div aria-hidden="true" className={`absolute inset-x-0 top-[1.9%] flex items-center justify-between px-[1.6em] text-[0.9em] font-semibold tnum ${dark ? "text-white" : "text-ink"}`}>
      <span>9:41</span>
      <span className="flex items-center gap-[0.3em] text-[0.7em] tracking-normal">
        <span>●●●●</span>
        <span className="inline-block h-[0.9em] w-[1.7em] rounded-[0.25em] border border-current p-[0.1em]">
          <span className="block h-full w-[80%] rounded-[0.12em] bg-current" />
        </span>
      </span>
    </div>
  );
}
