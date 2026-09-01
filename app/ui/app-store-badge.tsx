import { existsSync } from "node:fs";
import { join } from "node:path";
import { appStoreUrl } from "@/content/site";

const BADGE_SRC = "/badges/preorder-on-the-app-store-black.svg";
// build-time check: the placeholder renders until the official SVG lands, then swaps itself out.
// TODO(launch): add the official Apple badge at public/badges/preorder-on-the-app-store-black.svg
const hasBadge = existsSync(join(process.cwd(), "public", BADGE_SRC));

// the official Apple badge — never tilted, recolored, animated or shadowed (Apple marketing rules).
// clear space (≥25% of badge height) comes from the surrounding layout gaps, all ≥ height/4.
export function AppStoreBadge({ height = 56, className = "" }: { height?: number; className?: string }) {
  return (
    <a
      href={appStoreUrl}
      target="_blank"
      rel="noopener"
      aria-label="pre-order wisedinner on the App Store"
      className={`inline-block ${className}`}
    >
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
    </a>
  );
}
