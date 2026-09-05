import Link from "next/link";
import type { ReactNode } from "react";
import { HERO } from "@/app/copy";
import { APP_STORE_IS_LIVE, APP_STORE_URL } from "@/lib/links";

// every primary control on the site goes through here (WD-01).
// live: new tab to the App Store with the caller's label. not live: same-tab link to the waitlist, locked label "get early access".
// short: below md the label drops "get" so the header row still fits a 320px phone beside the wordmark (WD-08).
export function AppStoreLink({
  placement,
  className = "",
  tabIndex,
  short = false,
  "aria-label": ariaLabel,
  children,
}: {
  placement?: string;
  className?: string;
  tabIndex?: number;
  short?: boolean;
  "aria-label"?: string;
  children?: ReactNode;
}) {
  if (!APP_STORE_IS_LIVE) {
    return (
      <Link href={APP_STORE_URL} data-placement={placement} tabIndex={tabIndex} className={className}>
        {short ? (
          <>
            {/* &nbsp; — .cta is inline-flex, so plain spaces at these text-run boundaries would be dropped */}
            <span className="hidden md:inline">get&nbsp;</span>early&nbsp;access →
          </>
        ) : (
          HERO.waitlist
        )}
      </Link>
    );
  }
  return (
    <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} data-placement={placement} tabIndex={tabIndex} className={className}>
      {children ?? HERO.preorder}
    </a>
  );
}
