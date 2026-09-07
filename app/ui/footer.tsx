import Link from "next/link";
import { InstagramLogo, TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/app/wordmark";
import { site } from "@/content/site";
import { StoreBadges } from "./store-badges";

// FOOTER (REDESIGN-V3 §4): lockup + "hit your protein. spend way less."; badges when set; legal (privacy, terms) ·
// company (faq, support, press, protein index); TikTok + Instagram always shown, href "#" for now; © 2026 WiseDinner.
const GROUPS: [string, [string, string][]][] = [
  [
    "company",
    [
      ["faq", "/faq"],
      ["support", "/support"],
      ["press", "/press"],
      ["protein index", "/protein-index"],
    ],
  ],
  [
    "legal",
    [
      ["privacy", "/privacy"],
      ["terms", "/terms"],
    ],
  ],
];

export function Footer() {
  return (
    <footer className="border-t border-rule bg-bg-alt">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:grid-cols-[1.6fr_1fr_1fr] lg:px-12">
        <div>
          <Wordmark className="text-base" />
          <p className="mt-3 text-[1.0625rem] font-semibold">{site.hero.h1}</p>
          <StoreBadges placement="footer" height={40} className="mt-5" fallback={false} release={false} />
          <div className="mt-5 flex gap-2">
            <a href="#" aria-label="wisedinner on TikTok" className="grid size-11 place-items-center rounded-[10px] text-ink hover:bg-bg">
              <TiktokLogo size={22} weight="regular" aria-hidden="true" />
            </a>
            <a href="#" aria-label="wisedinner on Instagram" className="grid size-11 place-items-center rounded-[10px] text-ink hover:bg-bg">
              <InstagramLogo size={22} weight="regular" aria-hidden="true" />
            </a>
          </div>
        </div>
        {GROUPS.map(([name, links]) => (
          <nav key={name} aria-label={name}>
            <p className="text-caption font-semibold text-kale">{name}</p>
            <ul className="mt-3">
              {links.map(([l, h]) => (
                <li key={h}>
                  <Link href={h} className="text-link-quiet inline-flex min-h-11 items-center">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="sm:col-span-3">
          <p className="font-mono text-micro text-ink-soft">© 2026 WiseDinner</p>
          {/* TODO(launch): verify the exact wording on developer.apple.com/app-store/marketing/guidelines */}
          <p className="mt-2 text-[0.75rem] text-ink-3">
            Apple, the Apple logo, and iPhone are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a
            service mark of Apple Inc. Google Play and the Google Play logo are trademarks of Google LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
