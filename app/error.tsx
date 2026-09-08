"use client";

import Link from "next/link";
import { Section } from "./ui/section";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main">
      <Section className="min-h-[60dvh]">
        <p className="tnum text-xs uppercase text-ink-2">err 500</p>
        <h1 className="mt-6 text-h1 font-bold text-balance">something broke. it wasn&apos;t your fault.</h1>
        <div className="mt-10 flex flex-wrap gap-6">
          <button type="button" onClick={reset} className="cta">
            retry
          </button>
          <Link href="/support" className="text-link inline-flex min-h-11 items-center">
            tell support
          </Link>
        </div>
      </Section>
    </main>
  );
}
