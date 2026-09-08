import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "./ui/section";

// WD-11: the 404 carries its own title (it used to inherit the homepage's). Next already emits noindex + a real 404 status.
export const metadata: Metadata = { title: "Page not found — WiseDinner" };

export default function NotFound() {
  return (
    <main id="main">
      <Section className="min-h-[60dvh]">
        <p className="tnum text-xs uppercase text-ink-2">err 404 · nothing rotting here either</p>
        <h1 className="mt-6 text-h1 font-bold text-balance">this aisle doesn&apos;t exist.</h1>
        <div className="mt-10 flex flex-wrap gap-6">
          <Link href="/" className="cta">
            back home
          </Link>
        </div>
      </Section>
    </main>
  );
}
