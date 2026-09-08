{/* <!-- draft for attorney review before paid launch --> */}
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/app/ui/legal-layout";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using the WiseDinner website, its shared-week pages and the launch email list: what the estimates are and aren't, what the waitlist promises, and how we settle things.",
  alternates: { canonical: "/terms" },
};

const S: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are, and what you agree to",
    body: (
      <>
        <p>Wisedinner is made by WiseDinner. We&apos;ll call ourselves &quot;we&quot; or &quot;WiseDinner&quot;. You&apos;re &quot;you&quot;.</p>
        <p>These terms cover the WiseDinner website at WiseDinner.com, the shared-week pages on it, and the early-access waitlist. By using any of them you agree to these terms. If you don&apos;t agree, please don&apos;t use the site.</p>
        <p>The iOS app isn&apos;t out yet. When it ships it will have its own terms, and paid plans will have their own billing terms. Nothing here sells you anything.</p>
      </>
    ),
  },
  {
    id: "the-service",
    title: "The service",
    body: (
      <>
        <p>Right now the service is two things.</p>
        <ul>
          <li>
            <strong>Shared weeks.</strong> the WiseDinner app lets a user share a solved week as a card and a link on this site (WiseDinner.com/w/). A shared page shows the week&apos;s meals, its list and its estimated totals. It shows nothing about the person who shared it. The examples on this site today are fixtures, not real users&apos; weeks. The app itself has its own terms inside the app.
          </li>
          <li>
            <strong>A waitlist.</strong> you give us an email address and we tell you when the app is ready for pre-order and when it launches.
          </li>
        </ul>
        <p>We can change, pause, or shut down the shared-week pages or the waitlist at any time. It&apos;s pre-launch software and it will change.</p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "The important disclaimers",
    body: (
      <div className="mt-4 rounded-[14px] border border-forest bg-surface p-6">
        <p className="mt-0 font-medium">Please read this part properly.</p>
        <p>
          <strong>(a) prices are estimates.</strong> every price you see is an estimate built from public price data with a buffer added on top. Real prices in your store will differ, by region, by chain, by week, by what&apos;s on sale. We don&apos;t guarantee any total, and we don&apos;t guarantee that a plan fits your budget once you&apos;re at the register. Treat the number as a good guess, not a quote.
        </p>
        <p>
          <strong>(b) nutrition figures are estimates, and none of this is advice.</strong> protein and calorie numbers come from a food database and rounded package sizes. They are planning figures, not measurements. Wisedinner is not medical, dietary, nutritional, or professional advice, and it isn&apos;t a substitute for it. Before you change how you eat, talk to a doctor or a registered dietitian, especially if you have a health condition, are pregnant, take medication, or have a history of disordered eating.
        </p>
        <p>
          <strong>(c) &quot;projected savings&quot; compares two estimates.</strong> when we show a savings number, it is our estimated total compared with what <em>you</em> told us you currently spend. We didn&apos;t verify either side. It is a projection, not a measurement, and not a promise.
        </p>
        <p className="mb-0">The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, to the fullest extent the law allows.</p>
      </div>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use it",
    body: (
      <>
        <p>You need to be at least 16 to use the site. If you&apos;re under 18, use it with a parent or guardian who agrees to these terms for you.</p>
        <p>You also need to be able to enter a contract where you live, and you agree not to use the site where doing so is illegal.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Be reasonable. Specifically, don&apos;t:</p>
        <ul>
          <li>Scrape, crawl, or bulk-download the site, the price data, or plans, by hand or with a tool;</li>
          <li>Resell, republish, or package plans or price data as your own product;</li>
          <li>Hit the forms or the shared-week pages with automated traffic, or try to get around rate limits;</li>
          <li>Probe, break, or test the security of the site without asking us first;</li>
          <li>Submit someone else&apos;s email address, or abusive or unlawful content through the support form.</li>
        </ul>
        <p>If you do any of this we can block you, and we don&apos;t owe you a warning first.</p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Who owns what",
    body: (
      <>
        <p>The site, the solver, the code, the staple list and prices, the plans it produces, the WiseDinner name and mark, and all the design and copy are ours (or licensed to us). You can look at plans and use them to shop and cook. You can&apos;t copy or reuse them commercially.</p>
        <p>Your inputs, your budget, your targets, your pantry, your email, your messages, are yours. You give us a licence to store and process them so we can run the service, save your plan, and contact you about the app. That licence ends when we delete your data (see the privacy policy).</p>
        <p>If you send us feedback, we can use it without owing you anything. Thank you for it.</p>
      </>
    ),
  },
  {
    id: "waitlist",
    title: "The waitlist promises nothing",
    body: (
      <>
        <p>Joining the waitlist gets you an email when the app is ready and a place in the order we invite people. It does not guarantee you access, a launch date, a feature, a price, or a free trial. The prices on our pricing page are what we currently plan to charge in the app, and they can change before launch.</p>
        <p>You can leave the waitlist any time by emailing support@wisedinner.com.</p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Ending things",
    body: (
      <>
        <p>You can stop using the site whenever you like. You can ask us to delete your data whenever you like.</p>
        <p>We can suspend or end your access if you break these terms, if the law requires it, or if we shut the service down. Sections 3, 6, 9, and 10 keep applying after that.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limits on our liability",
    body: (
      <>
        <p>To the fullest extent the law allows, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost savings, food you bought that didn&apos;t match a plan, or any health outcome from following a plan.</p>
        <p>Our total liability to you for anything connected to the site is capped at the greater of $50 or the fees you paid us in the twelve months before the claim. Right now that&apos;s $0, so the cap is $50.</p>
        <p>Some places don&apos;t allow these limits. Where that&apos;s the case, they apply as far as the law permits.</p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law, and talking first",
    body: (
      <>
        <p>These terms are governed by the laws of Florida, USA, without regard to conflict-of-law rules.</p>
        <p>If there&apos;s a problem, email support@wisedinner.com first. We&apos;ll try to sort it out informally within 30 days. If we can&apos;t, either of us can take it to the state or federal courts located in Florida, USA, and you agree to that jurisdiction.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <>
        <p>We may update these terms. If the change matters, we&apos;ll post the new version here with a new effective date and, if you&apos;re on the waitlist, email you about it at least 14 days before it takes effect. Using the site after that date means you accept the new terms.</p>
        <p>Effective: August 30, 2026</p>
      </>
    ),
  },
];

export default function Terms() {
  return <LegalLayout title="terms of service" effective="August 30, 2026" sections={S} />;
}
