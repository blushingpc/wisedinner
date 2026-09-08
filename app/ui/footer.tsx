import Link from "next/link";
import { InstagramLogo, TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import { Lockup } from "@/app/lockup";
import { site } from "@/content/site";
import { StoreBadges } from "./store-badges";

// FOOTER (REDESIGN-V4 §6): white; the forest lockup, the tagline, both badges, Company and Legal columns, TikTok and
// Instagram (href "#" for now), the copyright line and the Apple and Google trademark line.
const GROUPS: [string, [string, string][]][] = [
  [
    "Company",
    [
      ["FAQ", "/faq"],
      ["Support", "/support"],
      ["Press", "/press"],
      ["Protein index", "/protein-index"],
    ],
  ],
  [
    "Legal",
    [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  ],
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:grid-cols-[1.6fr_1fr_1fr] lg:px-12">
        <div>
          <Lockup href="/" size={24} />
          <p className="mt-4 font-display text-[1.0625rem] font-bold tracking-[-0.01em]">{site.hero.h1}</p>
          <StoreBadges placement="footer" height={40} className="mt-5" release={false} />
          <div className="mt-5 -ml-2 flex gap-1">
            <a href="#" aria-label="WiseDinner on TikTok" className="grid size-11 place-items-center rounded-[10px] text-ink-2 transition-colors duration-200 hover:bg-surface hover:text-ink">
              <TiktokLogo size={22} weight="regular" aria-hidden="true" />
            </a>
            <a href="#" aria-label="WiseDinner on Instagram" className="grid size-11 place-items-center rounded-[10px] text-ink-2 transition-colors duration-200 hover:bg-surface hover:text-ink">
              <InstagramLogo size={22} weight="regular" aria-hidden="true" />
            </a>
          </div>
        </div>
        {GROUPS.map(([name, links]) => (
          <nav key={name} aria-label={name}>
            <p className="text-caption font-semibold text-ink">{name}</p>
            <ul className="mt-3">
              {links.map(([l, h]) => (
                <li key={h}>
                  <Link href={h} className="text-link-quiet inline-flex min-h-11 items-center text-ink-2 transition-colors duration-200 hover:text-ink">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="sm:col-span-3">
          <p className="text-xs text-ink-2 tnum">© 2026 WiseDinner</p>
          <p className="mt-2 max-w-[80ch] text-xs text-ink-2">
            Apple, the Apple logo, and iPhone are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc. Google Play and the Google Play logo are trademarks of Google LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
