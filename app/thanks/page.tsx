import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/app/ui/section";

export const metadata: Metadata = { title: "You're in — WiseDinner", robots: { index: false, follow: false } };

export default async function Thanks({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  const position = Number(n);
  return (
    <main id="main">
      <Section className="min-h-[60dvh]">
        <p className="font-mono text-micro uppercase text-green-600">early access</p>
        <h1 className="mt-6 text-display font-bold text-balance">
          you&apos;re in.{" "}
          {position > 0 && (
            <span className="font-mono font-medium tabular-nums">
              #{position}
            </span>
          )}{" "}
          on the list.
        </h1>
        <p className="mt-6 max-w-[62ch] text-xl text-ink-soft">one email when the app is ready. nothing before that.</p>
        <p className="mt-10 font-mono text-micro uppercase text-ink-soft">while you wait</p>
        <div className="mt-3 flex flex-wrap gap-6">
          <Link href="/start" className="cta">
            try the demo
          </Link>
          <Link href="/drop" className="text-link inline-flex min-h-11 items-center">
            get this week&apos;s drop
          </Link>
        </div>
      </Section>
    </main>
  );
}
