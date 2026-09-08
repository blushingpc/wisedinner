import type { Metadata } from "next";
import Image from "next/image";
import { PRESS_BOILERPLATE, SUPPORT_EMAIL } from "@/app/copy";
import { PageShell } from "@/app/ui/page-shell";

export const metadata: Metadata = {
  title: "Press",
  description: "The WiseDinner press kit: the one-paragraph boilerplate, the mark and lockup as SVG and PNG, the app icon, everything as one zip, and the address to write to.",
  alternates: { canonical: "/press" },
};

export default function Press() {
  return (
    <PageShell title="Press kit" wide>
      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-h3">Boilerplate</h2>
          <p className="mt-3 max-w-[62ch] text-lg text-ink-2">{PRESS_BOILERPLATE}</p>
          <h2 className="mt-10 text-h3">Contact</h2>
          <p className="mt-3">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <h2 className="mt-10 text-h3">Downloads</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <a href="/press/wisedinner-press-kit.zip" className="cta" download>
                Download the press kit (zip)
              </a>
            </li>
            <li className="text-sm text-ink-2">
              Contains the mark as SVG (forest and white), the mark as a 2048px PNG (forest and white), the lockup and the app icon. Or grab the{" "}
              <a href="/logo/wisedinner-mark.svg" className="text-link text-ink">
                SVG
              </a>{" "}
              and the{" "}
              <a href="/press/wisedinner-mark.png" className="text-link text-ink">
                PNG
              </a>{" "}
              on their own.
            </li>
          </ul>
          <p className="mt-8 max-w-[62ch] text-ink-2">The wordmark is always set in type in Plus Jakarta Sans. The mark stays one color: forest on white, or white on forest.</p>
        </div>
        <div className="grid gap-6 self-start">
          <div className="rounded-card border border-border bg-white p-10 shadow-card">
            <Image src="/press/wisedinner-lockup.png" alt="The WiseDinner lockup: the double-check W mark beside the wordmark" width={2400} height={800} sizes="(min-width: 1024px) 400px, 100vw" className="mx-auto h-auto w-full max-w-[360px]" />
          </div>
          <div className="flex items-center justify-center gap-8 rounded-card bg-surface p-10">
            <Image src="/press/wisedinner-mark.png" alt="The WiseDinner mark: a W drawn as two check marks" width={2048} height={958} sizes="160px" className="h-auto w-40" />
            <Image src="/press/wisedinner-app-icon.png" alt="The WiseDinner app icon: the white mark on a forest tile" width={1024} height={1024} sizes="96px" className="size-24" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
