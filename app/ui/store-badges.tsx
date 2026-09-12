import { APP_STORE_IS_LIVE, APP_STORE_URL, BADGES_LIVE, PLAY_IS_LIVE, PLAY_URL, RELEASE_DATE } from "@/lib/links";
import { PreorderButton } from "./preorder-modal";
import { BadgeImg } from "./badge-img";

// STORE BADGES (REDESIGN-V4 §6, MOBILE FIX PASS v2 §A): official artwork only, both served as static SVG inside a
// fixed-aspect box (never scaled non-uniformly, angled, animated or recolored). Apple's badge is the "Pre-order on the
// App Store" artwork from App Store Marketing Tools (public/badges/app-store-preorder.svg, same dimensions as the
// download badge); Google's is the Play badge. Apple first in any lineup.
// The artwork renders only while BADGES_LIVE (lib/links.ts): until the listing URL is set and the pre-order svg
// exists, every slot falls back to the forest "Pre-order now" button (`fallback="button"`), plain "App Store" and
// "Google Play" text links (`fallback="links"`) or nothing. Setting the env var and dropping the svg restores the
// badges everywhere in one deploy.
const ext = (live: boolean) => (live ? { target: "_blank", rel: "noopener noreferrer" } : {});

// the text-link fallback (footer): "App Store" and "Google Play", "#" until the URLs exist
export function StoreLinks({ placement, className = "" }: { placement: string; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-6 ${className}`}>
      <li>
        <a href={APP_STORE_URL} {...ext(APP_STORE_IS_LIVE)} data-placement={placement} className="text-link-quiet inline-flex min-h-11 items-center text-ink-2 transition-colors duration-200 hover:text-ink">
          App Store
        </a>
      </li>
      <li>
        <a href={PLAY_URL} {...ext(PLAY_IS_LIVE)} data-placement={`${placement}-play`} className="text-link-quiet inline-flex min-h-11 items-center text-ink-2 transition-colors duration-200 hover:text-ink">
          Google Play
        </a>
      </li>
    </ul>
  );
}

export function StoreBadges({
  height = 40,
  placement,
  className = "",
  dark = false,
  release = true,
  play = true,
  playClassName = "",
  wrap = true,
  fallback = "button",
  buttonClassName = "cta",
}: {
  height?: number;
  placement: string;
  className?: string;
  dark?: boolean;
  release?: boolean;
  play?: boolean;
  playClassName?: string;
  wrap?: boolean;
  fallback?: "button" | "links" | "none";
  buttonClassName?: string;
}) {
  if (!BADGES_LIVE) {
    if (fallback === "button") return <PreorderButton placement={placement} className={`${buttonClassName} ${className}`} />;
    if (fallback === "links") return <StoreLinks placement={placement} className={className} />;
    return null;
  }
  return (
    <div className={`flex items-center gap-x-3 gap-y-2 ${wrap ? "flex-wrap" : "flex-nowrap"} ${className}`}>
      <a href={APP_STORE_URL} {...ext(APP_STORE_IS_LIVE)} data-placement={placement} aria-label="Pre-order WiseDinner on the App Store" className="inline-block shrink-0 rounded-[8px]">
        <BadgeImg kind="apple" height={height} />
      </a>
      {play && (
        <a href={PLAY_URL} {...ext(PLAY_IS_LIVE)} data-placement={`${placement}-play`} aria-label="Pre-register WiseDinner on Google Play" className={`${playClassName || "inline-block"} shrink-0 rounded-[8px]`}>
          <BadgeImg kind="play" height={height} />
        </a>
      )}
      {release && RELEASE_DATE && <span className={`basis-full text-caption font-medium tnum ${dark ? "text-white/80" : "text-ink-2"}`}>Release: {RELEASE_DATE}</span>}
    </div>
  );
}
