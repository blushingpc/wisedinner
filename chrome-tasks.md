# Chrome-extension task pack
These are the jobs that live in dashboards, not the terminal. Open the right tab, then paste the block into Claude in Chrome. Review every form before it submits — the extension asks first; keep it that way for anything involving keys, money, or DNS. Do them in order; 1–3 unblock queue jobs 6, 11, and 12.

---
## Task 1 — Vercel: import the repo (tab: vercel.com, logged in)
> Import my GitHub repository "wisedinner" as a new Vercel project. Framework preset: Next.js, root directory: /, default build settings. Name the project wisedinner. Deploy it. When the first deploy finishes, tell me the *.vercel.app URL. Then open the project's Settings → Environment Variables page and stop there.

## Task 2 — Supabase: project + keys into Vercel (tabs: supabase.com and vercel.com)
> In Supabase, create a new project named wisedinner in the closest US region (generate and save a strong database password in the dashboard, do not paste it to me). When it finishes provisioning, open Project Settings → API and copy these three values: Project URL, anon public key, service_role key. Then switch to the Vercel wisedinner project → Settings → Environment Variables and add: NEXT_PUBLIC_SUPABASE_URL = the Project URL, NEXT_PUBLIC_SUPABASE_ANON_KEY = the anon key, SUPABASE_SERVICE_ROLE_KEY = the service_role key (all three environments). Save, then trigger a redeploy from the Deployments tab. Never paste the service_role key into the chat — dashboard to dashboard only.

## Task 3 — Domain: point wisedinner.com from Squarespace to Vercel (tabs: vercel.com and squarespace domains)
> In the Vercel wisedinner project, open Settings → Domains and add wisedinner.com and www.wisedinner.com. Vercel will display the exact DNS records it needs — read them from the screen (typically an A record @ → 76.76.21.21 and a CNAME www → cname.vercel-dns.com, but use exactly what Vercel shows). Then go to the Squarespace domains DNS settings for wisedinner.com, remove conflicting Squarespace defaults on @ and www, and add the records Vercel asked for. Come back to Vercel and confirm both domains show as configured. Tell me if Vercel reports the records as valid; note DNS can take up to an hour to propagate.

## Task 4 — Vercel Analytics on (tab: vercel.com)
> In the Vercel wisedinner project, open the Analytics tab and enable Web Analytics. Confirm it shows as enabled.

## Task 5 — later, when ready to charge (tab: dashboard.stripe.com)
> In Stripe, create two products: "WiseDinner Protein Plan" with prices $8.99/month and $59/year, and "WiseDinner Autopilot" with prices $12.99/month and $89/year, all USD, all with a 21-day free trial configured on the checkout side. Then copy the publishable key and secret key from Developers → API keys into the Vercel wisedinner project env vars as NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY, and redeploy. Do not paste the secret key into chat.

## Task 5b — App Store listing → flip the site to pre-order (tabs: appstoreconnect.apple.com, vercel.com) — when the listing exists
> In the Vercel wisedinner project → Settings → Environment Variables add NEXT_PUBLIC_APP_STORE_URL = the App Store listing URL and NEXT_PUBLIC_RELEASE_DATE = the expected release, e.g. "March 2027" (Production and Preview). Redeploy. Every primary control on the site flips from "get early access" to "pre-order on the App Store" and wisedinner.com/ios redirects to the listing. Separately, download the official "Pre-order on the App Store" badge (black, SVG) from Apple's marketing tools and commit it at public/badges/preorder-on-the-app-store-black.svg — until then a plain placeholder block renders in its place.

## Task 6 — Higgsfield (tab: higgsfield.ai, whenever you want assets)
Brand imagery, OG art variants, and TikTok hook videos happen there or from the Claude chat app with the Higgsfield connector approved. Not blocking anything in the queue — the receipt aesthetic is pure CSS.

---
Notes: keys travel dashboard→dashboard, never through chat. After Task 2, tell Claude Code "Supabase keys are in Vercel" so it unblocks queue job 6; after Task 3, "domain live" unblocks job 12.
