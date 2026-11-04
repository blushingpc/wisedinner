import { currentNodeHostPOST } from "../../../../../lib/current-node-host.server.ts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return currentNodeHostPOST("appleCredential", request);
}
