"use client";

import { useEffect } from "react";

// the whole motion stack: [data-reveal] elements get the from-state only once JS runs,
// then lose it when they scroll into view. no JS, no reduced motion → content is simply there.
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.remove("reveal-from");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of document.querySelectorAll("[data-reveal]")) {
      el.classList.add("reveal-from");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
