// loads .env.local once for the pipeline scripts (node 24: process.loadEnvFile). in github actions the values come
// from repository secrets and there is no file. values are never logged.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* already loaded or unreadable: the required() calls below report what is missing */
  }
}

export const env = (name: string) => process.env[name] ?? "";
export const has = (name: string) => Boolean(process.env[name]);
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (add it to .env.local or the workflow secrets)`);
  return v;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const log = (step: string, msg: string) => console.log(`[${step}] ${msg}`);

// the database is optional for --local runs (snapshot from authored data + fetch caches, no publish)
export const LOCAL = process.argv.includes("--local");
export const dbConfigured = () => has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY");
