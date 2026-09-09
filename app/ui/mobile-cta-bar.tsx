"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";
import { PreorderButton } from "./preorder-modal";

// the homepage places this empty div right after the hero CTA block; the bar shows while it is off-screen.
export const MOBILE_CTA_SENTINEL = "hero-cta-end";

// mobile-only sticky CTA bar once the hero button has scrolled away.
// the pre-order band carries extra mobile bottom padding so this never covers its button.
export function MobileCtaBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(MOBILE_CTA_SENTINEL);
    if (!el) return;
    // the root extends far below the page, so the only two states are "sentinel above the top edge" (show) and
    // "anywhere else" (hide); an instant jump from below the fold to past the hero cannot skip a state.
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { rootMargin: "0px 0px 100000px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`chrome fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border p-3 transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <p className="pb-1.5 text-center text-[0.75rem] text-ink-2">{site.hero.micro}</p>
      <PreorderButton placement="sticky" className="cta min-h-[52px] w-full" tabIndex={show ? 0 : -1} />
    </div>
  );
}
