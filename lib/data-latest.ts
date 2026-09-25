// the /api/data/latest body: the newest snapshot pointer plus live app config. the selector is injected so the
// route passes the service-key select and the tests pass stubs; a config read failure never breaks the pointer.
export type Selector = <T>(table: string, query?: string) => Promise<T[]>;

export type Pointer = { version: number; url: string; sha256: string; created_at: string };
export type Config = { founders_invite_url: string };
export type Latest = Pointer & { config: Config };

export const CONFIG_KEYS = ["founders_invite_url"] as const;

// every key from app_config, empty string when the row is missing or the read fails
export async function readConfig(sel: Selector): Promise<Config> {
  const config: Config = { founders_invite_url: "" };
  try {
    const rows = await sel<{ key: string; value: string }>("app_config", `select=key,value&key=in.(${CONFIG_KEYS.join(",")})`);
    for (const r of rows) if (r.key === "founders_invite_url" && typeof r.value === "string") config.founders_invite_url = r.value;
  } catch (e) {
    console.error("app_config read failed", (e as Error).message);
  }
  return config;
}

// null when no snapshot has been published yet; throws when the snapshot read itself fails (the route maps that to 502)
export async function latest(sel: Selector): Promise<Latest | null> {
  const rows = await sel<Pointer>("data_snapshots", "select=version,url,sha256,created_at&order=version.desc&limit=1");
  if (!rows[0]) return null;
  const { version, url, sha256, created_at } = rows[0];
  return { version, url, sha256, created_at, config: await readConfig(sel) };
}
