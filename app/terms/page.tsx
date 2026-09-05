{/* <!-- draft for attorney review before paid launch --> */}
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/app/ui/legal-layout";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of Service — WiseDinner",
  description: "the terms for using the wisedinner demo and launch email list: what the estimates are and aren't, what the waitlist promises, and how we settle things.",
  alternates: { canonical: "/terms" },
};

const S: LegalSection[] = [
  {
    id: "who-we-are",
    title: "who we are, and what you agree to",
    body: (
      <>
        <p>wisedinner is made by WiseDinner. we&apos;ll call ourselves &quot;we&quot; or &quot;wisedinner&quot;. you&apos;re &quot;you&quot;.</p>
        <p>these terms cover the wisedinner website at wisedinner.com, the free demo on it, the early-access waitlist, and the founding member pre-sale (section 8). by using any of them you agree to these terms. if you don&apos;t agree, please don&apos;t use the site.</p>
        <p>the ios app isn&apos;t out yet. when it ships it will have its own terms, and paid plans will have their own billing terms. the only thing for sale here today is the founding member pre-sale in section 8.</p>
      </>
    ),
  },
  {
    id: "the-service",
    title: "the service",
    body: (
      <>
        <p>right now the service is two things.</p>
        <ul>
          <li>
            <strong>a demo.</strong> you enter a weekly grocery budget, a daily protein target, a calorie band, a diet, how many people you feed, and what you already own. a deterministic solver picks items from a fixed list of grocery staples and returns a five-day plan, a shopping list, and an estimated in-store total. the same inputs always give the same plan. no ai model writes your plan.
          </li>
          <li>
            <strong>a waitlist.</strong> you give us an email address and we tell you when the app is ready. if you ask us to, we also keep the plan you generated so the app can pick it up.
          </li>
        </ul>
        <p>we can change, pause, or shut down the demo or the waitlist at any time. it&apos;s pre-launch software and it will change.</p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "the important disclaimers",
    body: (
      <div className="mt-4 rounded-[14px] border border-accent bg-accent-wash p-6">
        <p className="mt-0 font-medium">please read this part properly.</p>
        <p>
          <strong>(a) prices are estimates.</strong> every price you see is an estimate built from public price data with a buffer added on top. real prices in your store will differ — by region, by chain, by week, by what&apos;s on sale. we don&apos;t guarantee any total, and we don&apos;t guarantee that a plan fits your budget once you&apos;re at the register. treat the number as a good guess, not a quote.
        </p>
        <p>
          <strong>(b) nutrition figures are estimates, and none of this is advice.</strong> protein and calorie numbers come from a food database and rounded package sizes. they are planning figures, not measurements. wisedinner is not medical, dietary, nutritional, or professional advice, and it isn&apos;t a substitute for it. before you change how you eat, talk to a doctor or a registered dietitian — especially if you have a health condition, are pregnant, take medication, or have a history of disordered eating.
        </p>
        <p>
          <strong>(c) &quot;projected savings&quot; compares two estimates.</strong> when we show a savings number, it is our estimated total compared with what <em>you</em> told us you currently spend. we didn&apos;t verify either side. it is a projection, not a measurement, and not a promise.
        </p>
        <p className="mb-0">the service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, to the fullest extent the law allows.</p>
      </div>
    ),
  },
  {
    id: "eligibility",
    title: "who can use it",
    body: (
      <>
        <p>you need to be at least 16 to use the site. if you&apos;re under 18, use it with a parent or guardian who agrees to these terms for you.</p>
        <p>you also need to be able to enter a contract where you live, and you agree not to use the site where doing so is illegal.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "acceptable use",
    body: (
      <>
        <p>be reasonable. specifically, don&apos;t:</p>
        <ul>
          <li>scrape, crawl, or bulk-download the site, the price data, or plans, by hand or with a tool;</li>
          <li>resell, republish, or package plans or price data as your own product;</li>
          <li>hit the demo or the forms with automated traffic, or try to get around rate limits;</li>
          <li>probe, break, or test the security of the site without asking us first;</li>
          <li>submit someone else&apos;s email address, or abusive or unlawful content through the support form.</li>
        </ul>
        <p>if you do any of this we can block you, and we don&apos;t owe you a warning first.</p>
      </>
    ),
  },
  {
    id: "ip",
    title: "who owns what",
    body: (
      <>
        <p>the site, the solver, the code, the staple list and prices, the plans it produces, the wisedinner name and mark, and all the design and copy are ours (or licensed to us). you can look at plans and use them to shop and cook. you can&apos;t copy or reuse them commercially.</p>
        <p>your inputs — your budget, your targets, your pantry, your email, your messages — are yours. you give us a licence to store and process them so we can run the service, save your plan, and contact you about the app. that licence ends when we delete your data (see the privacy policy).</p>
        <p>if you send us feedback, we can use it without owing you anything. thank you for it.</p>
      </>
    ),
  },
  {
    id: "waitlist",
    title: "the waitlist promises nothing",
    body: (
      <>
        <p>joining the waitlist gets you an email when the app is ready and a place in the order we invite people. it does not guarantee you access, a launch date, a feature, a price, or a free trial. the prices on our pricing page are what we currently plan to charge in the app, and they can change before launch.</p>
        <p>you can leave the waitlist any time by emailing support@wisedinner.com.</p>
      </>
    ),
  },
  {
    id: "founding-member",
    title: "founding member pre-sale",
    body: (
      <>
        {/* attorney review before this goes further: pre-sale of a product that does not yet exist, refund trigger tied to a launch date, non-transferability, and whether the $59 first-year credit needs its own consumer-protection wording in Florida. */}
        <p>
          a founding membership costs <strong>${site.founding.priceUsd}</strong>, paid once, through a stripe payment link. it is a pre-sale. the app is still in development and you are not buying software that exists today.
        </p>
        <p>what you get:</p>
        <ul>
          <li>
            your first year of {site.pricing.tiers[0].name} free when the app launches (the yearly plan currently lists at ${site.pricing.tiers[0].yearly}), applied to the app account that uses the email you paid with;
          </li>
          <li>an invite to a private channel with the people building wisedinner;</li>
          <li>a say in what ships first — we ask, we listen, we decide.</li>
        </ul>
        <p>
          <strong>the refund guarantee.</strong> if the app has not launched on the app store by {site.founding.refundBy}, we refund every dollar you paid, in full, to the card you paid with, without you having to ask. we&apos;ll email you when we do. you can also ask for the refund yourself any time after that date by emailing support@wisedinner.com. before that date, the pre-sale is non-refundable except where the law says otherwise.
        </p>
        <p>a founding membership is tied to the email address you paid with. it is non-transferable: you can&apos;t sell it, give it away, or move it to another person or account.</p>
        <p>the pre-sale does not guarantee a launch date, a feature, or a price for anything beyond the first free year. your first year is free; after that, the plan renews at the price shown in the app at the time, and you can cancel before it does.</p>
      </>
    ),
  },
  {
    id: "termination",
    title: "ending things",
    body: (
      <>
        <p>you can stop using the site whenever you like. you can ask us to delete your data whenever you like.</p>
        <p>we can suspend or end your access if you break these terms, if the law requires it, or if we shut the service down. sections 3, 6, 8, 10, and 11 keep applying after that.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "limits on our liability",
    body: (
      <>
        <p>to the fullest extent the law allows, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost savings, food you bought that didn&apos;t match a plan, or any health outcome from following a plan.</p>
        <p>our total liability to you for anything connected to the site is capped at the greater of $50 or the fees you paid us in the twelve months before the claim. the founding member refund in section 8 is separate from this cap.</p>
        <p>some places don&apos;t allow these limits. where that&apos;s the case, they apply as far as the law permits.</p>
      </>
    ),
  },
  {
    id: "law",
    title: "governing law, and talking first",
    body: (
      <>
        <p>these terms are governed by the laws of Florida, USA, without regard to conflict-of-law rules.</p>
        <p>if there&apos;s a problem, email support@wisedinner.com first. we&apos;ll try to sort it out informally within 30 days. if we can&apos;t, either of us can take it to the state or federal courts located in Florida, USA, and you agree to that jurisdiction.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "changes to these terms",
    body: (
      <>
        <p>we may update these terms. if the change matters, we&apos;ll post the new version here with a new effective date and, if you&apos;re on the waitlist, email you about it at least 14 days before it takes effect. using the site after that date means you accept the new terms.</p>
        <p>effective: August 30, 2026</p>
      </>
    ),
  },
];

export default function Terms() {
  return <LegalLayout title="terms of service" effective="August 30, 2026" sections={S} />;
}
