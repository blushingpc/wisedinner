import { currentNodeHostPOST } from "../../../../../lib/current-node-host.server.ts";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  return currentNodeHostPOST("currentSession", request);
}
