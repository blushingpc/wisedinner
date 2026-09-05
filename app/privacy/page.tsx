{/* <!-- draft for attorney review before paid launch --> */}
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/app/ui/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy — WiseDinner",
  description: "what wisedinner collects, what it never does with it, where it lives, how long we keep it, and how to see or delete it. no data sales, not ever.",
  alternates: { canonical: "/privacy" },
};

const S: LegalSection[] = [
  {
    id: "collect",
    title: "what we collect",
    body: (
      <>
        <p>very little, and only when you hand it to us.</p>
        <ul>
          <li>
            <strong>your email address</strong>, if you join the waitlist, plus a one-word note on where you signed up (for example &quot;hero&quot;, &quot;plan&quot;, or &quot;drop&quot;). the email is stored lowercase and only once.
          </li>
          <li>
            <strong>your quiz answers</strong>, if you join the waitlist from a solved plan and tell us to keep it: budget, protein target, calorie band, diet, household size, pantry items, and the estimated total. answers you enter in the demo but don&apos;t save live only in your browser&apos;s session storage and vanish when the tab closes.
          </li>
          <li>
            <strong>support messages</strong>: your name if you give it, your email, and what you wrote.
          </li>
          <li>
            <strong>cookieless analytics</strong>. we use vercel web analytics, which counts page views and a handful of named events (like &quot;demo completed&quot;) without cookies, without fingerprinting, and without a persistent identifier for you. it records a hashed, rotating visitor id, your country, device type, and referrer. it can&apos;t follow you across sites.
          </li>
        </ul>
        <p>we don&apos;t ask for your name on the waitlist, your address, your payment details, or your health information. please don&apos;t put health information in the support form.</p>
      </>
    ),
  },
  {
    id: "dont",
    title: "what we don't do",
    body: (
      <>
        <p>plainly:</p>
        <ul>
          <li>we set no cookies of our own. none. so there&apos;s no cookie banner, because there&apos;s nothing to consent to.</li>
          <li>we run no advertising trackers, pixels, or third-party scripts that profile you.</li>
          <li>we do not sell your data. we do not share it for advertising. not now, not at launch, not as the business model — ever.</li>
          <li>we don&apos;t send marketing beyond the launch email(s) you signed up for.</li>
        </ul>
      </>
    ),
  },
  {
    id: "where",
    title: "where it lives",
    body: (
      <>
        <p>the waitlist and support messages are stored in a supabase (postgres) database hosted in the united states. the website runs on vercel, which also provides the analytics. both are processors acting on our instructions; they don&apos;t get to use your data for their own purposes.</p>
        <p>if you&apos;re outside the us, your data is transferred to and stored in the us when you submit it.</p>
      </>
    ),
  },
  {
    id: "why",
    title: "why we use it",
    body: (
      <>
        <ul>
          <li>to keep a waitlist and tell you, in order, when the app is ready;</li>
          <li>to hand your saved plan to the app on day one, if you asked for that;</li>
          <li>to answer your support message;</li>
          <li>to see, in aggregate, which pages and steps work and which don&apos;t.</li>
        </ul>
        <p>the legal basis, where one is required, is your consent (you typed it in and pressed the button) and our legitimate interest in running and improving a small pre-launch site.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "how long we keep it",
    body: (
      <>
        <p>waitlist entries and saved plans stay until the launch cycle ends — meaning the app has shipped and invites have gone out — or until you ask us to delete them, whichever comes first. after launch we&apos;ll either delete the waitlist or move your entry into your app account, and we&apos;ll email you before we do either.</p>
        <p>support messages are kept for up to 12 months so we can follow up, then deleted.</p>
        <p>analytics are aggregate and are retained by vercel under their policy.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "your rights",
    body: (
      <>
        <p>you can ask us, at any time, to:</p>
        <ul>
          <li>tell you everything we hold about you;</li>
          <li>correct it;</li>
          <li>delete all of it, including your waitlist place;</li>
          <li>send you a copy in a plain format.</li>
        </ul>
        <p>email support@wisedinner.com from the address in question. we confirm within 7 days and complete the request within 30. no forms, no account required. if you live somewhere with a data-protection regulator, you can also complain to them; we&apos;d rather you told us first.</p>
      </>
    ),
  },
  {
    id: "under-16",
    title: "under 16",
    body: (
      <>
        <p>the site isn&apos;t for people under 16 and we don&apos;t knowingly collect their data. if you think we have some, email us and we&apos;ll delete it.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "changes to this policy",
    body: (
      <>
        <p>if we change what we collect or why, we&apos;ll update this page with a new effective date and email the waitlist before the change takes effect. small wording fixes just get posted here.</p>
        <p>effective: August 30, 2026</p>
      </>
    ),
  },
];

export default function Privacy() {
  return <LegalLayout title="privacy policy" effective="August 30, 2026" sections={S} />;
}
