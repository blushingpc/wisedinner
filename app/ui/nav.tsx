import Link from "next/link";
import { Wordmark } from "@/app/wordmark";
import { PreorderButton } from "./preorder-button";

// < 768px: wordmark + pre-order button on the first row, the three links on a second row (WD-08 — measured:
//   wordmark 115px + the CTA 161px leave 12px at 320px, so the links cannot share the row at any type size).
// ≥ 768px: wordmark · how it works · pricing · faq · pre-order on the App Store → on one row.
const LINKS: [string, string][] = [
  ["how it works", "/#how"],
  ["pricing", "/pricing"],
  ["faq", "/faq"],
];

export function Nav() {
  return (
    <header className="chrome sticky top-0 z-(--z-sticky) border-b border-rule">
      <nav aria-label="primary" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 px-4 pt-3 pb-1 sm:px-6 md:flex-nowrap md:gap-x-6 md:py-3 lg:px-12">
        <Wordmark />
        <ul className="order-last flex w-full items-center gap-5 text-sm md:order-none md:ml-auto md:w-auto md:gap-6 md:text-base">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center whitespace-nowrap">
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <PreorderButton short placement="header" className="ml-auto md:ml-0" />
      </nav>
    </header>
  );
}
