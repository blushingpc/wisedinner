"use client";

import { useEffect, useState } from "react";
import { APP_STORE_IS_LIVE } from "@/lib/links";
import { AppStoreLink } from "./app-store-link";

// the homepage places this empty div right after the hero CTA block; the bar shows while it is off-screen (WD-03).
export const MOBILE_CTA_SENTINEL = "hero-cta-end";

// mobile-only sticky pre-order bar once the hero CTA has scrolled away.
// the final CTA section carries extra mobile bottom padding so this never covers its form.
export function MobileCtaBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(MOBILE_CTA_SENTINEL);
    if (!el) return;
    // the root extends far below the page, so the only two states are "sentinel above the top edge" (show) and
    // "anywhere else" (hide) — an instant jump from below the fold to past the hero can't skip a state.
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { rootMargin: "0px 0px 100000px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`chrome fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule p-3 transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <p className="pb-1.5 text-center text-[0.75rem] text-ink-soft">{APP_STORE_IS_LIVE ? "free · installs itself on launch day" : "no account · takes a minute"}</p>
      <AppStoreLink placement="sticky" className="cta min-h-[52px] w-full" tabIndex={show ? 0 : -1}>
        pre-order on the App Store →
      </AppStoreLink>
    </div>
  );
}
