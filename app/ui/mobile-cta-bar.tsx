"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";
import { PreorderButton } from "./preorder-modal";

// the homepage places this empty div right after the hero CTA block; the bar shows while it is off-screen.
export const MOBILE_CTA_SENTINEL = "hero-cta-end";
// the pre-order band's id: the bar hides while the band is in view (its own button is right there)
export const PREORDER_BAND = "preorder";

// STICKY PRE-ORDER BAR (MOBILE FIX PASS v2 §E), phones only: shows once the hero button has scrolled out of view,
// hides again while the pre-order band is on screen, pads for the home indicator, the microline under its button.
// globals.css gives the homepage footer matching bottom padding so nothing ends up behind it.
export function MobileCtaBar() {
  const [heroGone, setHeroGone] = useState(false);
  const [bandInView, setBandInView] = useState(false);
  useEffect(() => {
    const hero = document.getElementById(MOBILE_CTA_SENTINEL);
    const band = document.getElementById(PREORDER_BAND);
    if (!hero) return;
    // the root extends far below the page, so the only two states are "sentinel above the top edge" (gone) and
    // "anywhere else" (hide); an instant jump from below the fold to past the hero cannot skip a state.
    const io = new IntersectionObserver(([entry]) => setHeroGone(!entry.isIntersecting), { rootMargin: "0px 0px 100000px 0px" });
    io.observe(hero);
    const io2 = band ? new IntersectionObserver(([entry]) => setBandInView(entry.isIntersecting)) : null;
    if (band && io2) io2.observe(band);
    return () => {
      io.disconnect();
      io2?.disconnect();
    };
  }, []);
  const show = heroGone && !bandInView;
  return (
    <div
      aria-hidden={!show}
      className={`chrome cta-bar fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <PreorderButton placement="sticky" className="cta min-h-[52px] w-full" tabIndex={show ? 0 : -1} />
      <p className="pt-1.5 text-center text-[0.75rem] text-ink-2">{site.hero.micro}</p>
    </div>
  );
}
