import {site} from "../../content/site.ts";
// Backend support facts only, not website copy/legal publication or native connection proof.
export function currentScope(){
 const plan=site.pricing.tiers.find(t=>t.name==="Protein Plan");
 if(!plan||plan.monthly!==8.99||plan.yearly!==48)throw Error("Current subscription price source needs review");
 return `Current founder-approved app scope, October 4, 2026. This overrides historical website/FAQ facts. Implementation and store configuration are not yet verified live.
WiseDinner plans five days of meals using a deterministic budget/protein solver. Grocery prices are estimates, with whole purchasable packs and honest consumed portions, preparation trim and carryover. No nationwide/local accuracy or nutritional certification is promised.
Launch requires an account using Apple, Google or email, without phone/SMS. App access requires a verified eligible fourteen-day auto-renewable store trial or verified existing subscription access. Protein Plan is $${plan.monthly.toFixed(2)} monthly or $${plan.yearly.toFixed(2)} annually. Rerolls are included, never separately charged. Do not promise every customer another trial; the store determines eligibility and a subscription renews unless canceled. There is no ongoing Free tier.
Notifications are optional; refusal must not block app use. Login/logout, purchase restoration/management, support and account deletion remain accessible without active paid access. Account deletion does not cancel an Apple subscription. Billing/account questions still escalate to a person rather than requesting private details.
Courier arrives in an update after release. Delivery, receipt reveal, leaderboard/challenge, web checkout, waitlist and chatbot are outside this run. Do not claim a pre-order listing is live, a release date or timeframe, or any configuration/feature is connected without current evidence.
Email sign-in mode, release date, reroll grocery-addition/weekly-budget rule and founders purchase-date interpretation are undecided. Escalate rather than invent these answers.
Account, purchase and optional push data make Data Not Collected inappropriate. New app privacy/retention policy is a draft awaiting review; historical website legal text is not the app's new policy.`;
}
