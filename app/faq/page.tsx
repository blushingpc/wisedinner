import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/app/copy";
import { Accordion } from "@/app/ui/accordion";
import { Section } from "@/app/ui/section";

export const metadata: Metadata = {
  title: "FAQ — WiseDinner",
  description: "How the solver works, how accurate the prices are, what it will cost, and what we do with your data.",
  alternates: { canonical: "/faq" },
};

const LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default function Faq() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(LD)}</script>
      <Section>
        <p className="font-mono text-micro uppercase text-ink-soft">faq</p>
        <h1 className="mt-4 text-display font-bold">questions.</h1>
        <div className="mt-10 max-w-[70ch]">
          <Accordion items={FAQ} />
        </div>
        <p className="mt-10 text-ink-soft">
          something else?{" "}
          <Link href="/support" className="text-link">
            ask support
          </Link>
          .
        </p>
      </Section>
    </main>
  );
}
