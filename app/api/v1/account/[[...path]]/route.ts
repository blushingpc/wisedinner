import { AccountError, accountHandler, loadCatalogPin, supabaseAccountRepository, supabaseVerifier } from "../../../../../lib/account.ts";

export const runtime = "nodejs";
async function handle(request: Request) {
  // Default-off until migration/RLS/provider/retention checks and a separately authorized rollout.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.WD_ACCOUNT_API_ENABLED !== "true" || !url || !key) return Response.json({ error: "account_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const verify = supabaseVerifier(url, key);
    const account = await verify(request);
    const revision = process.env.WD_ACCOUNT_CATALOG_REVISION;
    const pin = revision && request.method === "POST" && new URL(request.url).pathname.endsWith("/weeks") ? await loadCatalogPin(url, key, account.token, revision) : undefined;
    return await accountHandler({ verify: async () => account, repository: supabaseAccountRepository(url, key), pin })(request);
  }
  catch (error) {
    const safe = error instanceof AccountError ? error : new AccountError(503, "account_not_configured");
    return Response.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
