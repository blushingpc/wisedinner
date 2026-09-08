import Link from "next/link";
import { List } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/app/wordmark";
import { APP_STORE_IS_LIVE, PLAY_IS_LIVE } from "@/lib/links";
import { PreorderButton } from "./preorder-button";
import { StoreBadges } from "./store-badges";

// NAV (REDESIGN-V3 §4): lockup · how it works · pricing · faq · badges on the right when set, else the forest
// "get early access". Mobile: lockup + CTA + hamburger (native <details>, so it works without JS and the keyboard
// gets it for free: Tab to the summary, Enter/Space toggles, links inside are plain links).
const LINKS: [string, string][] = [
  ["how it works", "/#how"],
  ["pricing", "/pricing"],
  ["faq", "/faq"],
];

export function Nav() {
  const live = APP_STORE_IS_LIVE || PLAY_IS_LIVE;
  return (
    <header className="chrome sticky top-0 z-(--z-sticky) border-b border-border">
      <nav aria-label="primary" className="mx-auto flex max-w-[1200px] items-center gap-x-3 px-4 py-3 sm:px-6 md:gap-x-6 lg:px-12">
        <Wordmark />
        <ul className="ml-auto hidden items-center gap-6 text-base md:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center whitespace-nowrap">
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {live ? <StoreBadges placement="header" height={40} className="ml-auto flex-nowrap md:ml-0" fallback={false} release={false} playClassName="hidden shrink-0 md:inline-block" /> : <PreorderButton short placement="header" className="ml-auto md:ml-0" />}
        {/* mobile: hamburger with the three links in a sheet under the bar */}
        <details className="group relative md:hidden">
          <summary aria-label="menu" className="grid size-11 cursor-pointer list-none place-items-center rounded-[10px] text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
            <List size={24} weight="bold" aria-hidden="true" />
          </summary>
          <ul className="sheet-drop absolute right-0 top-[calc(100%+0.5rem)] w-[220px] rounded-[14px] border border-border bg-white p-2 shadow-card">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="flex min-h-11 items-center rounded-[10px] px-3 text-base font-medium hover:bg-surface">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </nav>
    </header>
  );
}
