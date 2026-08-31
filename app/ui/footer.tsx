import Link from "next/link";
import { Wordmark } from "@/app/wordmark";

const NAV = [
  ["how it works", "/#how"],
  ["faq", "/faq"],
  ["pricing", "/pricing"],
  ["this week's drop", "/drop"],
  ["about", "/about"],
  ["press", "/press"],
  ["support", "/support"],
];
const LEGAL = [
  ["terms", "/terms"],
  ["privacy", "/privacy"],
];

export function Footer() {
  return (
    <footer className="border-t border-rule bg-bg-alt">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-6 py-12 lg:grid-cols-[1fr_auto_auto] lg:px-12">
        <Wordmark className="self-start text-base" />
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {NAV.map(([l, h]) => (
            <li key={h}>
              <Link href={h} className="inline-flex min-h-11 items-center">
                {l}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex gap-6">
          {LEGAL.map(([l, h]) => (
            <li key={h}>
              <Link href={h} className="inline-flex min-h-11 items-center">
                {l}
              </Link>
            </li>
          ))}
        </ul>
        <p className="font-mono text-micro text-ink-soft lg:col-span-3">© 2026 WiseDinner</p>
      </div>
    </footer>
  );
}
