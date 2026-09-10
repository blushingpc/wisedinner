{/* <!-- draft for attorney review before paid launch --> */}
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/app/ui/legal-layout";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What WiseDinner collects (almost nothing: the site takes no email for pre-order), what it never does with it, where it lives, how long we keep it, and how to see or delete it. No data sales, not ever.",
  alternates: { canonical: "/privacy" },
};

const S: LegalSection[] = [
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>Very little, and only when you hand it to us.</p>
        <ul>
          <li>
            <strong>Nothing for pre-order.</strong> The Pre-order now button sends you to the App Store or Google Play. The pre-order happens there, under that store&apos;s privacy policy. This site takes no email address, no account and no payment for it. We see only the anonymous analytics event that the button was used.
          </li>
          <li>
            <strong>Shared weeks</strong>. When you share a week from the app, the card and its numbers, the meals, the list, the estimated totals, are published at a link on this site. Nothing about you travels with it: no name, no email, no device identifier. The shared pages on this site today are fixtures.
          </li>
          <li>
            <strong>Support messages</strong>: your name if you give it, your email, and what you wrote.
          </li>
          <li>
            <strong>Cookieless analytics</strong>. We use Vercel Web Analytics, which counts page views and a handful of named events (like &quot;pre-order opened&quot;) without cookies, without fingerprinting, and without a persistent identifier for you. It records a hashed, rotating visitor id, your country, device type, and referrer. It can&apos;t follow you across sites.
          </li>
        </ul>
        <p>We don&apos;t ask for your name, your address, your payment details, or your health information anywhere on this site. Please don&apos;t put health information in the support form.</p>
      </>
    ),
  },
  {
    id: "dont",
    title: "What we don't do",
    body: (
      <>
        <p>Plainly:</p>
        <ul>
          <li>We set no cookies of our own. None. So there&apos;s no cookie banner, because there&apos;s nothing to consent to.</li>
          <li>We run no advertising trackers, pixels, or third-party scripts that profile you.</li>
          <li>We do not sell your data. We do not share it for advertising. Not now, not at launch, not as the business model, ever.</li>
          <li>We send no marketing email. The site collects no email address for that purpose.</li>
        </ul>
      </>
    ),
  },
  {
    id: "where",
    title: "Where it lives",
    body: (
      <>
        <p>Support messages (and the entries from the retired early-access waitlist, see below) are stored in a Supabase (Postgres) database hosted in the United States. The website runs on Vercel, which also provides the analytics. Both are processors acting on our instructions; they don&apos;t get to use your data for their own purposes.</p>
        <p>If you&apos;re outside the US, your data is transferred to and stored in the US when you submit it.</p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <>
        <ul>
          <li>To send you to the App Store or Google Play when you tap Pre-order now (the store handles the pre-order itself);</li>
          <li>To answer your support message;</li>
          <li>To see, in aggregate, which pages and steps work and which don&apos;t.</li>
        </ul>
        <p>The legal basis, where one is required, is your consent (you typed it in and pressed the button) and our legitimate interest in running and improving a small site.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <p>Nothing from the pre-order flow is kept here; the store keeps your pre-order. The early-access waitlist that ran on this site before pre-order opened is closed: the entries it collected stay until the app has shipped or until you ask us to delete them, whichever comes first, and after launch we&apos;ll delete them (we email those addresses before we do).</p>
        <p>Support messages are kept for up to 12 months so we can follow up, then deleted.</p>
        <p>Analytics are aggregate and are retained by Vercel under their policy.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>You can ask us, at any time, to:</p>
        <ul>
          <li>Tell you everything we hold about you;</li>
          <li>Correct it;</li>
          <li>Delete all of it, including any entry from the retired waitlist;</li>
          <li>Send you a copy in a plain format.</li>
        </ul>
        <p>Email support@wisedinner.com from the address in question. We confirm within 7 days and complete the request within 30. No forms, no account required. If you live somewhere with a data-protection regulator, you can also complain to them; we&apos;d rather you told us first.</p>
      </>
    ),
  },
  {
    id: "under-16",
    title: "Under 16",
    body: (
      <>
        <p>The site isn&apos;t for people under 16 and we don&apos;t knowingly collect their data. If you think we have some, email us and we&apos;ll delete it.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        <p>If we change what we collect or why, we&apos;ll update this page with a new effective date, posted here at least 14 days before the change takes effect. Small wording fixes just get posted here.</p>
        <p>Effective: September 9, 2026</p>
      </>
    ),
  },
];

export default function Privacy() {
  return <LegalLayout title="Privacy policy" effective="September 9, 2026" sections={S} />;
}
