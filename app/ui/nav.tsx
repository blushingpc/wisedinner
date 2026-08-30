import Link from "next/link";
import { Wordmark } from "@/app/wordmark";

export function Nav() {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-rule bg-bg/96">
      <nav aria-label="primary" className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3 lg:px-12">
        <Wordmark />
        <div className="flex items-center gap-6">
          <Link href="/#how" className="hidden min-h-11 items-center sm:inline-flex">
            how it works
          </Link>
          <Link href="/faq" className="hidden min-h-11 items-center sm:inline-flex">
            faq
          </Link>
          <Link href="/#early-access" className="cta">
            get early access
          </Link>
        </div>
      </nav>
    </header>
  );
}
