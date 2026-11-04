export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Liveness only. Never asserts source/Auth/billing/private release readiness. */
export function GET(){return Response.json({status:"ok"},{headers:{"Cache-Control":"no-store"}});}
