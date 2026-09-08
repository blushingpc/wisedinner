{/* <!-- draft for attorney review before paid launch --> */}
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/app/ui/legal-layout";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What WiseDinner collects, what it never does with it, where it lives, how long we keep it, and how to see or delete it. No data sales, not ever.",
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
            <strong>Your email address</strong>, if you join the waitlist, plus a one-word note on where you signed up (for example &quot;hero&quot;, &quot;final&quot;, or &quot;drop&quot;). The email is stored lowercase and only once.
          </li>
          <li>
            <strong>Shared weeks</strong>. When you share a week from the app, the card and its numbers, the meals, the list, the estimated totals, are published at a link on this site. Nothing about you travels with it: no name, no email, no device identifier. The shared pages on this site today are fixtures.
          </li>
          <li>
            <strong>Support messages</strong>: your name if you give it, your email, and what you wrote.
          </li>
          <li>
            <strong>Cookieless analytics</strong>. We use Vercel Web Analytics, which counts page views and a handful of named events (like &quot;waitlist joined&quot;) without cookies, without fingerprinting, and without a persistent identifier for you. It records a hashed, rotating visitor id, your country, device type, and referrer. It can&apos;t follow you across sites.
          </li>
        </ul>
        <p>We don&apos;t ask for your name on the waitlist, your address, your payment details, or your health information. Please don&apos;t put health information in the support form.</p>
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
          <li>We don&apos;t send marketing beyond the launch email(s) you signed up for.</li>
        </ul>
      </>
    ),
  },
  {
    id: "where",
    title: "Where it lives",
    body: (
      <>
        <p>The waitlist and support messages are stored in a Supabase (Postgres) database hosted in the United States. The website runs on Vercel, which also provides the analytics. Both are processors acting on our instructions; they don&apos;t get to use your data for their own purposes.</p>
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
          <li>To keep a waitlist and tell you, in order, when the app is ready;</li>
          <li>To hand your saved plan to the app on day one, if you asked for that;</li>
          <li>To answer your support message;</li>
          <li>To see, in aggregate, which pages and steps work and which don&apos;t.</li>
        </ul>
        <p>The legal basis, where one is required, is your consent (you typed it in and pressed the button) and our legitimate interest in running and improving a small pre-launch site.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <p>Waitlist entries and saved plans stay until the launch cycle ends, meaning the app has shipped and invites have gone out, or until you ask us to delete them, whichever comes first. After launch we&apos;ll either delete the waitlist or move your entry into your app account, and we&apos;ll email you before we do either.</p>
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
          <li>Delete all of it, including your waitlist place;</li>
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
        <p>If we change what we collect or why, we&apos;ll update this page with a new effective date and email the waitlist before the change takes effect. Small wording fixes just get posted here.</p>
        <p>Effective: August 30, 2026</p>
      </>
    ),
  },
];

export default function Privacy() {
  return <LegalLayout title="privacy policy" effective="August 30, 2026" sections={S} />;
}
