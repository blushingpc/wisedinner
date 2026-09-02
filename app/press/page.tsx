import type { Metadata } from "next";
import Image from "next/image";
import { PRESS_BOILERPLATE, SUPPORT_EMAIL } from "@/app/copy";
import { Section } from "@/app/ui/section";

export const metadata: Metadata = {
  title: "Press — WiseDinner",
  description: "press kit for wisedinner: the one-paragraph boilerplate, the vector mark and a 2048px png, everything as one zip, and the address to write to.",
  alternates: { canonical: "/press" },
};

export default function Press() {
  return (
    <main id="main">
      <Section className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-mono text-micro uppercase text-green-600">press</p>
          <h1 className="mt-4 text-display font-bold">press kit.</h1>
          <h2 className="mt-10 font-mono text-micro uppercase text-ink-soft">boilerplate</h2>
          <p className="mt-3 max-w-[62ch] text-xl">{PRESS_BOILERPLATE}</p>
          <h2 className="mt-10 font-mono text-micro uppercase text-ink-soft">contact</h2>
          <p className="mt-3">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <h2 className="mt-10 font-mono text-micro uppercase text-ink-soft">downloads</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <a href="/press/wisedinner-press-kit.zip" className="cta" download>
                download press kit (.zip)
              </a>
            </li>
            <li className="font-mono text-spec text-ink-soft">
              contains: wisedinner-mark.svg (vector) · wisedinner-mark.png (2048 px, transparent) ·{" "}
              <a href="/logo/wisedinner-mark.svg" className="text-link">
                svg
              </a>{" "}
              ·{" "}
              <a href="/press/wisedinner-mark.png" className="text-link">
                png
              </a>
            </li>
          </ul>
          <p className="mt-8 max-w-[62ch] text-ink-soft">the wordmark is always set in type; please don&apos;t rasterize it. the mark stays single-colour, ink on white or white on ink.</p>
        </div>
        <div className="self-start rounded-[14px] border border-rule bg-bg-alt p-12">
          <Image src="/press/wisedinner-mark.png" alt="the wisedinner mark: a monoline lowercase w followed by a period" width={512} height={512} className="mx-auto h-auto w-48" />
        </div>
      </Section>
    </main>
  );
}
