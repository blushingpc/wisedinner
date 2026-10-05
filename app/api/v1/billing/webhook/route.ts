import { supabaseBillingRepository, webhookHandler } from "../../../../../lib/billing.ts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  const appId = process.env.REVENUECAT_APP_ID;
  if (process.env.WD_BILLING_API_ENABLED !== "true" || !url || !service || !authorization || !appId) return Response.json({ error: "billing_not_configured" }, { status: 503,headers:{"Cache-Control":"no-store"} });
  return webhookHandler({ authorization, appId, environment: "PRODUCTION", repository: supabaseBillingRepository(url, service) })(request);
}
