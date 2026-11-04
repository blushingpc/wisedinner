import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
/** Read-only Node transport. Existing binder validates exact bytes/identity and
 * current expiry on every admission; this loader confers no source authority. */
export function readCurrentBundledCapsule(version: "v4" | "v5" | "v7" | "v9" | "v11", moduleUrl: string): string {
  if (!["v4", "v5", "v7", "v9", "v11"].includes(version)) throw Error("capsule_version");
  const name = "generated-current-source-capsule-" + version + ".json";
  const adjacent = new URL("./" + name, moduleUrl);
  if (adjacent.protocol === "file:" && existsSync(adjacent)) return readFileSync(adjacent, "utf8");
  // next start runs from the packaged application root. Fixed, traced filenames
  // survive Webpack's module URL rewrite without any request-supplied path.
  return readFileSync(join(process.cwd(), "lib", name), "utf8");
}
