"use client";

import { useEffect, useState } from "react";

// §17 tier-3 item 6: mobile-only sticky "get early access" bar once the visitor is past
// half the page — and never on top of the final CTA, which asks properly.
export function MobileCtaBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const half = (document.documentElement.scrollHeight - window.innerHeight) / 2;
      const final = document.getElementById("early-access");
      const finalVisible = final ? final.getBoundingClientRect().top < window.innerHeight : false;
      setShow(window.scrollY > half && !finalVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule bg-bg/95 p-3 backdrop-blur transition-transform duration-300 ease-out sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <a href="#early-access" className="cta w-full" tabIndex={show ? 0 : -1}>
        get early access
      </a>
    </div>
  );
}
