import Link from "next/link";
import { Wordmark } from "@/app/wordmark";

// §9.12: grouped product / company / legal. the "tiny team" line lives on /about, where it is charming.
const GROUPS: [string, [string, string][]][] = [
  [
    "product",
    [
      ["how it works", "/#how"],
      ["pricing", "/pricing"],
      ["this week's drop", "/drop"],
      ["faq", "/faq"],
    ],
  ],
  [
    "company",
    [
      ["about", "/about"],
      ["press", "/press"],
      ["support", "/support"],
    ],
  ],
  [
    "legal",
    [
      ["terms", "/terms"],
      ["privacy", "/privacy"],
    ],
  ],
];

export function Footer() {
  return (
    <footer className="border-t border-rule bg-bg-alt">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-12">
        <Wordmark className="self-start text-base" />
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
        <p className="font-mono text-micro text-ink-soft sm:col-span-4">© 2026 WiseDinner</p>
      </div>
    </footer>
  );
}
