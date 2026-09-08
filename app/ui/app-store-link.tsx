import Link from "next/link";
import type { ReactNode } from "react";
import { HERO } from "@/app/copy";
import { APP_STORE_IS_LIVE, APP_STORE_URL, EARLY_ACCESS_URL } from "@/lib/links";

// every text CTA on the site goes through here (a control must never dead-end).
// live: a new tab to the App Store with the caller's label. not live: a same-tab link to the early-access form.
// short: below md the label drops "Get" so a narrow row still fits.
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
      <Link href={EARLY_ACCESS_URL} data-placement={placement} tabIndex={tabIndex} className={className}>
        {short ? (
          <>
            {/* &nbsp;: .cta is inline-flex, so plain spaces at these text-run boundaries would be dropped */}
            <span className="hidden md:inline">Get&nbsp;</span>early&nbsp;access
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
