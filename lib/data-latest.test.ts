import assert from "node:assert/strict";
import { test } from "node:test";
import { latest, readConfig, type Selector } from "./data-latest.ts";

const pointer = { version: 4, url: "https://x/snapshots/v4.json", sha256: "03169aaf", created_at: "2026-09-12T18:41:09Z" };
const sel =
  (config: () => Promise<{ key: string; value: string }[]>): Selector =>
  async (table) => {
    if (table === "data_snapshots") return [pointer] as never;
    if (table === "app_config") return (await config()) as never;
    throw new Error(`unexpected table ${table}`);
  };

test("the seeded empty string comes back as config.founders_invite_url", async () => {
  const body = await latest(sel(async () => [{ key: "founders_invite_url", value: "" }]));
  assert.deepEqual(body, { ...pointer, config: { founders_invite_url: "" } });
});

test("a set value comes back verbatim; unknown keys are ignored", async () => {
  const body = await latest(sel(async () => [{ key: "other", value: "x" }, { key: "founders_invite_url", value: "https://wisedinner.com/founders?i=abc" }]));
  assert.equal(body?.config.founders_invite_url, "https://wisedinner.com/founders?i=abc");
  assert.deepEqual(Object.keys(body!.config), ["founders_invite_url"]);
});

test("a missing row still returns the pointer with an empty string", async () => {
  const body = await latest(sel(async () => []));
  assert.equal(body?.version, 4);
  assert.equal(body?.config.founders_invite_url, "");
});

test("a config read failure never breaks the snapshot pointer", async () => {
  const body = await latest(
    sel(async () => {
      throw new Error("PostgREST 500");
    }),
  );
  assert.deepEqual(body, { ...pointer, config: { founders_invite_url: "" } });
  assert.deepEqual(await readConfig(async () => Promise.reject(new Error("down"))), { founders_invite_url: "" });
});

test("no snapshot yet is null; a snapshot read failure still throws", async () => {
  assert.equal(await latest(async () => [] as never), null);
  await assert.rejects(latest(async () => Promise.reject(new Error("down"))), /down/);
});

test("the pointer carries no source or confidence field", async () => {
  const body = await latest(sel(async () => []));
  assert.doesNotMatch(JSON.stringify(body), /"(source|confidence)"\s*:/);
});
