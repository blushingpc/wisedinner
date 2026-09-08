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
        <p className="tnum text-xs uppercase text-forest">launch email</p>
        <h1 className="mt-6 text-h1 font-bold text-balance">
          you&apos;re in.{" "}
          {position > 0 && (
            <span className="tnum font-medium tabular-nums">
              #{position}
            </span>
          )}{" "}
          on the list.
        </h1>
        <p className="mt-6 max-w-[62ch] text-xl text-ink-2">one email when the app is ready. nothing before that.</p>
        <p className="mt-10 tnum text-xs uppercase text-ink-2">while you wait</p>
        <div className="mt-3 flex flex-wrap gap-6">
          <Link href="/drop" className="text-link inline-flex min-h-11 items-center">
            get this week&apos;s drop
          </Link>
        </div>
      </Section>
    </main>
  );
}
