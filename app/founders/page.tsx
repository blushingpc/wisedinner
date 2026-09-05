import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/app/copy";
import { Section } from "@/app/ui/section";
import { WHATSAPP_INVITE_LINK } from "@/lib/links";

// the Stripe payment link's success URL (set in the Stripe dashboard → after payment → redirect to https://www.wisedinner.com/founders).
// no session lookup, no gate: the page only holds an invite link and a promise, so anyone who finds it sees nothing they can't ask for.
export const metadata: Metadata = { title: "You're in — WiseDinner", robots: { index: false, follow: false } };

export default function Founders() {
  return (
    <main id="main">
      <Section className="min-h-[60dvh]">
        <p className="font-mono text-micro uppercase text-green-600">founding member</p>
        <h1 className="mt-6 text-display font-bold text-balance">you&apos;re in. here&apos;s the room.</h1>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          {WHATSAPP_INVITE_LINK ? (
            <a href={WHATSAPP_INVITE_LINK} target="_blank" rel="noopener noreferrer" className="cta">
              join the private channel →
            </a>
          ) : (
            <p className="max-w-[44ch] text-xl text-ink-soft">your invite to the private channel is on its way by email.</p>
          )}
        </div>
        <p className="mt-6 max-w-[62ch] text-xl text-ink-soft">
          we&apos;ll email your TestFlight invite from <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link">{SUPPORT_EMAIL}</a>.
        </p>
        <p className="mt-10 font-mono text-micro uppercase text-ink-soft">while you wait</p>
        <div className="mt-3 flex flex-wrap gap-6">
          <Link href="/start" className="text-link inline-flex min-h-11 items-center">
            try the free demo
          </Link>
          <Link href="/drop" className="text-link inline-flex min-h-11 items-center">
            get this week&apos;s drop
          </Link>
        </div>
      </Section>
    </main>
  );
}
