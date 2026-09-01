import Link from "next/link";
import { Wordmark } from "@/app/wordmark";
import { PreorderButton } from "./preorder-button";

// < 768px: wordmark + one pre-order button, nothing else (links live in the footer).
// ≥ 768px: wordmark · how it works · pricing · faq · pre-order on the App Store →.
export function Nav() {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-rule bg-bg/96">
      <nav aria-label="primary" className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-12">
        <Wordmark />
        <div className="flex items-center gap-2 md:gap-6">
          <Link href="/#how" className="hidden min-h-11 items-center whitespace-nowrap md:inline-flex">
            how it works
          </Link>
          <Link href="/pricing" className="hidden min-h-11 items-center md:inline-flex">
            pricing
          </Link>
          <Link href="/faq" className="hidden min-h-11 items-center md:inline-flex">
            faq
          </Link>
          <PreorderButton short placement="header" />
        </div>
      </nav>
    </header>
  );
}
