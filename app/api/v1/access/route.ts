import { AccountError, supabaseAccountRepository, supabaseVerifier } from "../../../../lib/account.ts";
import { billingAccessHandler, revenueCatProvider, supabaseBillingRepository } from "../../../../lib/billing.ts";

export const runtime = "nodejs";
async function handle(request: Request) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const providerKey = process.env.REVENUECAT_SECRET_API_KEY;
  const entitlement = process.env.REVENUECAT_PROTEIN_ENTITLEMENT_ID;
  const monthly = process.env.REVENUECAT_MONTHLY_PRODUCT_ID, annual = process.env.REVENUECAT_ANNUAL_PRODUCT_ID;
  if (process.env.WD_BILLING_API_ENABLED !== "true" || process.env.WD_REVENUECAT_CONFIGURATION_VERIFIED !== "true" || !url || !anon || !service || !providerKey || !entitlement || !monthly || !annual) return Response.json({ error: "billing_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const accountRepository = supabaseAccountRepository(url, anon);
    return await billingAccessHandler({ verify: supabaseVerifier(url, anon), assertActive: async account => { await accountRepository.execute(account, { action: "read", body: {}, key: null }); }, repository: supabaseBillingRepository(url, service), provider: revenueCatProvider(providerKey), config: { environment: "PRODUCTION", entitlement, products: [monthly, annual] } })(request);
  } catch (error) {
    const safe = error instanceof AccountError ? error : new AccountError(503, "billing_not_configured");
    return Response.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
