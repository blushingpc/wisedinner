import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ABOUT } from "@/app/copy";
import { Section } from "@/app/ui/section";

export const metadata: Metadata = {
  title: "About — WiseDinner",
  description: "why we built a grocery solver instead of another macro tracker, how two numbers become a solved week, and the three things we refuse to do.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <main id="main">
      <Section className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-micro uppercase text-green-600">about</p>
          <h1 className="mt-4 text-display font-bold text-balance">groceries, as a math problem.</h1>
          <div className="mt-8 max-w-[62ch] space-y-5 text-xl">
            {ABOUT.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <p className="text-ink-soft">— the wisedinner team</p>
          </div>
          <Link href="/press" className="text-link mt-8 inline-flex min-h-11 items-center">
            press kit →
          </Link>
        </div>
        <Image
          src="/img/staples-flatlay.jpg"
          alt="overhead flat lay of pantry staples on linen: dry lentils, rice, oats, canned beans, eggs, and a tub of greek yogurt"
          width={1600}
          height={893}
          quality={75}
          sizes="(min-width: 1024px) 640px, 100vw"
          className="img-grade h-auto w-full self-start rounded-[14px]"
        />
      </Section>
    </main>
  );
}
