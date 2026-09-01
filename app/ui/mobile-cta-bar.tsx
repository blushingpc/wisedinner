"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";

// mobile-only sticky pre-order bar once the visitor is past half the page.
// the final CTA section carries extra mobile bottom padding so this never covers its form.
export function MobileCtaBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const half = (document.documentElement.scrollHeight - window.innerHeight) / 2;
      const footer = document.querySelector("footer");
      const footerVisible = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setShow(window.scrollY > half && !footerVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule bg-bg/95 p-3 backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <p className="pb-1.5 text-center text-[0.75rem] text-ink-soft">free · installs itself on launch day</p>
      <a href={site.appStoreUrl} target="_blank" rel="noopener noreferrer" data-placement="sticky" className="cta min-h-[52px] w-full" tabIndex={show ? 0 : -1}>
        pre-order on the App Store →
      </a>
    </div>
  );
}
