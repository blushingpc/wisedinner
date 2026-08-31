"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WaitlistForm } from "./waitlist-form";

// §9.1 — the header CTA never jumps the page: hero field on screen → focus it,
// otherwise a slide-down sheet with the field. href stays as the no-JS fallback.
export function HeaderCta() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLAnchorElement>(null);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const hero = document.getElementById("email-hero");
    if (hero) {
      const r = hero.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= window.innerHeight) {
        setOpen(false);
        hero.focus();
        return;
      }
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById("email-header")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Link ref={btn} href="/#early-access" onClick={onClick} className="cta" aria-expanded={open} aria-controls="header-sheet">
        get early access
      </Link>
      {open && (
        <div id="header-sheet" className="sheet-drop absolute inset-x-0 top-full border-b border-rule bg-bg shadow-receipt">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-10 gap-y-4 px-6 py-6 lg:px-12">
            <p className="max-w-[24ch] text-h3 font-bold text-balance">early access, one email away.</p>
            <WaitlistForm source="header" />
          </div>
        </div>
      )}
    </>
  );
}
