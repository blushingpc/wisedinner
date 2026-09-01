"use client";

import { useState } from "react";
import { site } from "@/content/site";
import { WaitlistForm } from "./waitlist-form";

// hero tertiary — quiet "not on iPhone?" link that expands the email fallback inline (200ms height/opacity)
export function HeroEmailFallback({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="hero-email"
        className="min-h-11 text-[0.9375rem] font-medium underline-offset-4 hover:underline"
      >
        {site.hero.notOnIphone}
      </button>
      <div
        id="hero-email"
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="max-w-md pt-3">
            <WaitlistForm source="hero" />
          </div>
        </div>
      </div>
    </div>
  );
}
