import Link from "next/link";
import { Section } from "./ui/section";

export default function NotFound() {
  return (
    <main id="main">
      <Section className="min-h-[60dvh]">
        <p className="font-mono text-micro uppercase text-ink-soft">err 404 · nothing rotting here either</p>
        <h1 className="mt-6 text-display font-bold text-balance">this aisle doesn&apos;t exist.</h1>
        <div className="mt-10 flex flex-wrap gap-6">
          <Link href="/" className="cta">
            back home
          </Link>
          <Link href="/start" className="text-link inline-flex min-h-11 items-center">
            try the free demo →
          </Link>
        </div>
      </Section>
    </main>
  );
}
