import { AccountError, supabaseAccountRepository, supabaseVerifier } from "../../../../../lib/account.ts";
import { supabaseBillingRepository } from "../../../../../lib/billing.ts";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.WD_BILLING_API_ENABLED !== "true" || !url || !anon || !service) return Response.json({ error: "billing_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    if (new URL(request.url).search) throw new AccountError(400, "invalid_query");
    const account = await supabaseVerifier(url, anon)(request);
    await supabaseAccountRepository(url, anon).execute(account, { action: "read", body: {}, key: null });
    return Response.json({ apiVersion: 1, ...await supabaseBillingRepository(url, service).bind(account.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = error instanceof AccountError ? error : new AccountError(503, "billing_unavailable");
    return Response.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
