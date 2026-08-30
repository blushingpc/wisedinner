# WiseDinner — Claude Code operating contract

You are building WiseDinner: a budget+protein meal solver. Web app first (Next.js on Vercel, Supabase, Stripe later). The receipt is the brand.

## Non-negotiables
1. **One job per session.** The job comes from `tasks/QUEUE.md` — top unblocked item. Never invent work mid-session; new ideas go to the bottom of the queue with a metric tag.
2. **Simplicity beats completeness.** Load the `keep-it-simple` skill before writing code. If a diff feels impressive, it is probably wrong.
3. **Nothing ships ugly or AI-looking.** Load the `human-design` skill before touching any UI file.
4. **Product truth lives in the `wisedinner-truth` skill.** Pricing honesty rules there are hard constraints, not suggestions.
5. **Session ritual lives in the `loop-protocol` skill.** Start and end every session with it.
6. **Deployed or it didn't happen.** A job is done when it's live on Vercel and verified, not when code exists.

## Stack (fixed — do not add to it)
Next.js (App Router, TS strict) · Tailwind (tokens only, no plugins) · Supabase (db + auth later) · Vercel (hosting, analytics) · Stripe (when keys exist). No other services, no new deps without a one-line justification in the commit message.

## Commands
- dev: `npm run dev` · build check: `npm run build` · deploy: push to `main` (Vercel auto-deploys)
