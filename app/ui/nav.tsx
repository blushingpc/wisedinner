import Link from "next/link";
import { Wordmark } from "@/app/wordmark";
import { PreorderButton } from "./preorder-button";

const LINKS = [
  ["how it works", "/#how"],
  ["faq", "/faq"],
  ["pricing", "/pricing"],
  ["this week's drop", "/drop"],
  ["support", "/support"],
];

export function Nav() {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-rule bg-bg/96">
      <nav aria-label="primary" className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-6 py-3 lg:px-12">
        <Wordmark />
        <div className="flex items-center gap-2 sm:gap-6">
          <Link href="/#how" className="hidden min-h-11 items-center sm:inline-flex">
            how it works
          </Link>
          <Link href="/pricing" className="hidden min-h-11 items-center sm:inline-flex">
            pricing
          </Link>
          <Link href="/faq" className="hidden min-h-11 items-center sm:inline-flex">
            faq
          </Link>
          <PreorderButton short />
          {/* ponytail: native details = hamburger with zero JS; swap for a client component if focus-trapping ever matters */}
          <details className="group relative sm:hidden">
            <summary aria-label="menu" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[12px] border border-rule [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="flex flex-col gap-1">
                <span className="h-0.5 w-5 bg-ink transition-transform group-open:translate-y-1.5 group-open:rotate-45" />
                <span className="h-0.5 w-5 bg-ink group-open:opacity-0" />
                <span className="h-0.5 w-5 bg-ink transition-transform group-open:-translate-y-1.5 group-open:-rotate-45" />
              </span>
            </summary>
            <ul className="absolute right-0 z-(--z-modal) mt-3 w-56 rounded-[14px] border border-rule bg-bg py-2 shadow-receipt">
              {LINKS.map(([l, h]) => (
                <li key={h}>
                  <Link href={h} className="flex min-h-11 items-center px-4">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </nav>
    </header>
  );
}
