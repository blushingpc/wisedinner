import { existsSync } from "node:fs";
import { join } from "node:path";
import { APP_STORE_IS_LIVE, RELEASE_DATE } from "@/lib/links";
import { AppStoreLink } from "./app-store-link";

const BADGE_SRC = "/badges/preorder-on-the-app-store-black.svg";
// build-time check: the placeholder renders until the official SVG lands, then swaps itself out.
// TODO(launch): add the official Apple badge at public/badges/preorder-on-the-app-store-black.svg
const hasBadge = existsSync(join(process.cwd(), "public", BADGE_SRC));

// the official Apple badge — never tilted, recolored, animated or shadowed (Apple marketing rules).
// clear space (≥25% of badge height) comes from the surrounding layout gaps, all ≥ height/4.
// before the listing is live the badge is a lie, so the placement renders the waitlist CTA instead. RELEASE_DATE rides under the badge.
export function AppStoreBadge({ height = 56, placement, className = "" }: { height?: number; placement?: string; className?: string }) {
  if (!APP_STORE_IS_LIVE) return <AppStoreLink placement={placement} className={`cta ${className}`} />;
  return (
    <span className={`inline-block ${className}`}>
      <AppStoreLink placement={placement} className="inline-block" aria-label="pre-order wisedinner on the App Store">
      {hasBadge ? (
        // eslint-disable-next-line @next/next/no-img-element -- svg badge, no optimization pass wanted
        <img src={BADGE_SRC} alt="Pre-order on the App Store" style={{ height, width: "auto" }} />
      ) : (
        <span
          className="flex flex-col items-center justify-center rounded-[8px] border border-[#A6A6A6] bg-black leading-none text-white"
          style={{ height, width: height * 3 }}
        >
          <span className="text-[11px]">Pre-order on the</span>
          <span className="mt-1 text-[19px] font-semibold">App Store</span>
        </span>
      )}
      </AppStoreLink>
      {RELEASE_DATE && <span className="mt-2 block text-caption font-semibold text-kale">expected {RELEASE_DATE}</span>}
    </span>
  );
}
