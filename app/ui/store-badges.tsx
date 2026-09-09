import { APP_STORE_IS_LIVE, APP_STORE_URL, PLAY_IS_LIVE, PLAY_URL, RELEASE_DATE } from "@/lib/links";

// STORE BADGES (REDESIGN-V4 §6): official artwork only, both served as static SVG with explicit dimensions. Apple's
// black badge (the badge API SVG; the "Pre-order" wording lands from App Store Marketing Tools once the listing
// exists, same path) and Google's Play badge. Apple first in any lineup. Never scaled non-uniformly, angled, animated
// or recolored. Always visible; each links to "#" until its URL is set, then opens the listing in a new tab.
const BADGE = {
  apple: { src: "/badges/app-store-black.svg", w: 119.664, h: 40, alt: "Download on the App Store" },
  play: { src: "/badges/google-play.svg", w: 180, h: 53.333, alt: "Get it on Google Play" },
} as const;

// one badge image at a given height, width from the artwork's own ratio (the pre-order modal composes its own links)
export function BadgeImg({ kind, height }: { kind: keyof typeof BADGE; height: number }) {
  const b = BADGE[kind];
  const width = Math.round((b.w / b.h) * height);
  // eslint-disable-next-line @next/next/no-img-element -- the store's own svg, served as-is
  return <img src={b.src} alt={b.alt} width={width} height={height} style={{ height, width: "auto" }} />;
}

export function StoreBadges({ height = 40, placement, className = "", dark = false, release = true, play = true, playClassName = "", wrap = true }: { height?: number; placement?: string; className?: string; dark?: boolean; release?: boolean; play?: boolean; playClassName?: string; wrap?: boolean }) {
  const ext = (live: boolean) => (live ? { target: "_blank", rel: "noopener noreferrer" } : {});
  return (
    <div className={`flex items-center gap-x-3 gap-y-2 ${wrap ? "flex-wrap" : "flex-nowrap"} ${className}`}>
      <a href={APP_STORE_URL} {...ext(APP_STORE_IS_LIVE)} data-placement={placement} aria-label="Pre-order WiseDinner on the App Store" className="inline-block shrink-0 rounded-[8px]">
        <BadgeImg kind="apple" height={height} />
      </a>
      {play && (
        <a href={PLAY_URL} {...ext(PLAY_IS_LIVE)} data-placement={placement ? `${placement}-play` : undefined} aria-label="Pre-register WiseDinner on Google Play" className={`${playClassName || "inline-block"} shrink-0 rounded-[8px]`}>
          <BadgeImg kind="play" height={height} />
        </a>
      )}
      {release && RELEASE_DATE && <span className={`basis-full text-caption font-medium tnum ${dark ? "text-white/80" : "text-ink-2"}`}>Release: {RELEASE_DATE}</span>}
    </div>
  );
}
