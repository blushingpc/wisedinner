"use client";

import Link from "next/link";
import { PageShell } from "./ui/page-shell";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageShell title="Something broke" sub="Error 500. It was not your fault. Try again, or tell support and we will look." className="min-h-[50dvh]">
      <div className="flex flex-wrap items-center justify-center gap-6">
        <button type="button" onClick={reset} className="cta">
          Try again
        </button>
        <Link href="/support" className="text-link inline-flex min-h-11 items-center">
          Tell support
        </Link>
      </div>
    </PageShell>
  );
}
