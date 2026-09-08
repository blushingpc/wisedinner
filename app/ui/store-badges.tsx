import Image from "next/image";
import { APP_STORE_IS_LIVE, APP_STORE_URL, PLAY_IS_LIVE, PLAY_URL, RELEASE_DATE } from "@/lib/links";
import { AppStoreLink } from "./app-store-link";

// STORE BADGES (REDESIGN-V3 §2C): official artwork only — Apple's black badge (Apple badge API SVG; the "Pre-order"
// wording lands from App Store Marketing Tools once the listing exists, same path) and Google's Play badge PNG.
// Apple first in any lineup. Never scaled non-uniformly, angled, animated or recolored; clear space comes from the
// surrounding gaps. Neither renders until its URL is set; production leaves both unset (badges hidden) until the
// real listing exists. Preview sets both to "#" for design review.
const APPLE = { src: "/badges/app-store-black.svg", w: 119.664, h: 40 };
const PLAY = { src: "/badges/google-play.png", w: 646, h: 250 };

export function StoreBadges({ height = 48, placement, className = "", fallback = true, dark = false, release = true, playClassName = "" }: { height?: number; placement?: string; className?: string; fallback?: boolean; dark?: boolean; release?: boolean; playClassName?: string }) {
  if (!APP_STORE_IS_LIVE && !PLAY_IS_LIVE) {
    return fallback ? <AppStoreLink placement={placement} className={`cta ${className}`} /> : null;
  }
  // the Play badge artwork carries its own padding; match visual heights by scaling it 1.15×
  const playH = Math.round(height * 1.15);
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      {APP_STORE_IS_LIVE && (
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" data-placement={placement} aria-label="pre-order wisedinner on the App Store" className="inline-block shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- Apple's svg, served as-is */}
          <img src={APPLE.src} alt="Download on the App Store" width={Math.round((APPLE.w / APPLE.h) * height)} height={height} style={{ height, width: "auto" }} />
        </a>
      )}
      {PLAY_IS_LIVE && (
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" data-placement={placement ? `${placement}-play` : undefined} aria-label="get wisedinner on Google Play" className={playClassName || "inline-block shrink-0"}>
          <Image src={PLAY.src} alt="Get it on Google Play" width={PLAY.w} height={PLAY.h} sizes={`${Math.round((PLAY.w / PLAY.h) * playH)}px`} style={{ height: playH, width: "auto" }} />
        </a>
      )}
      {release && RELEASE_DATE && <span className={`basis-full tnum text-caption font-semibold ${dark ? "text-white/80" : "text-forest"}`}>release: {RELEASE_DATE}</span>}
    </div>
  );
}
