import Link from "next/link";
import { List } from "@phosphor-icons/react/dist/ssr";
import { Lockup } from "@/app/lockup";
import { StoreBadges } from "./store-badges";
import { HeaderShadow } from "./header-shadow";

// HEADER (REDESIGN-V4 §6, MOBILE FIX PASS v2 §A/§B): 72px on desktop, 60px on phones, white, hairline bottom, sticky;
// a shadow only once the page has scrolled (HeaderShadow). Lockup left (mark 28px, 15px on phones so the wordmark
// has room next to the button); nav centered in Inter 500; right: the store badges while BADGES_LIVE, otherwise the
// forest "Pre-order now" button. Mobile: lockup, that button and a hamburger (native <details>: works without JS, Tab
// reaches the summary, Enter/Space toggles).
const LINKS: [string, string][] = [
  ["How it works", "/#how"],
  ["Pricing", "/pricing"],
  ["FAQ", "/faq"],
];

export function Nav() {
  return (
    <header className="chrome header-bar sticky top-0 z-(--z-sticky) border-b border-border">
      <HeaderShadow />
      <nav aria-label="Primary" className="mx-auto flex h-[60px] max-w-[1200px] items-center gap-x-2 px-4 sm:px-6 lg:h-[72px] lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-12">
        <div className="hidden lg:block">
          <Lockup href="/" size={28} thin />
        </div>
        <div className="lg:hidden">
          <Lockup href="/" size={15} thin />
        </div>
        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center font-medium whitespace-nowrap text-ink-2 transition-colors duration-200 hover:text-ink">
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-x-1 lg:ml-0 lg:gap-x-3 lg:justify-self-end">
          <StoreBadges placement="header" height={32} release={false} wrap={false} playClassName="hidden lg:inline-block" fallback="button" buttonClassName="cta cta-sm" />
          {/* mobile: the three links in a sheet under the bar */}
          <details className="group relative lg:hidden">
            <summary aria-label="Menu" className="grid size-11 cursor-pointer list-none place-items-center rounded-[10px] text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
              <List size={24} weight="bold" aria-hidden="true" />
            </summary>
            <ul className="sheet-drop absolute top-[calc(100%+0.75rem)] right-0 w-[220px] rounded-card border border-border bg-white p-2 shadow-card">
              {LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-11 items-center rounded-[10px] px-3 font-medium hover:bg-surface">
                    {label}
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
