"use client";

import { useEffect } from "react";

// the header's shadow appears only after the page has scrolled (MOBILE FIX PASS v2 §B): a passive scroll listener
// flips data-scrolled on <html>; globals.css draws the shadow. Renders nothing.
export function HeaderShadow() {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => root.toggleAttribute("data-scrolled", scrollY > 4);
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return null;
}
