import {isPurchasedQuoteRow} from "./generated-regional-quote.ts";
import type { RegionalQuoteOutcome, RegionalQuoteOutcomeV2, RegionalQuoteOutcomeV3 } from "./generated-regional-quote.ts";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { hash } from "../scripts/data/price-evidence.ts";

type Quote = Extract<RegionalQuoteOutcome | RegionalQuoteOutcomeV2 | RegionalQuoteOutcomeV3, { outcome: "quoted" }>;
export type ShoppingCheck = { readonly itemKey: string; readonly fingerprint: string; readonly checked: boolean };
export type ShoppingCheckState = { readonly status: "ready"; readonly rows: readonly ShoppingCheck[] } | { readonly status: "held"; readonly code: "new_week_carry_policy_required" };
type ErrorOutcome = { readonly outcome: "error"; readonly code: "invalid_shopping_input" | "shopping_row_missing" | "stale_shopping_row" };
type Reconciled = { readonly outcome: "reconciled"; readonly policy: "current-week-exact-row-only"; readonly rows: readonly ShoppingCheck[]; readonly invalidatedItemKeys: readonly string[]; readonly removedItemKeys: readonly string[] };
function invalid(): never { throw new Error("Invalid shopping check"); }
function digest(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid(); return value; }
function entry(value: unknown): ShoppingCheck {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== "checked|fingerprint|itemKey") invalid();
  const row = value as Record<string, unknown>; if (typeof row.checked !== "boolean") invalid();
  return { itemKey: digest(row.itemKey), fingerprint: digest(row.fingerprint), checked: row.checked };
}
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

// Quote is an actual canonical internal result, not client JSON. A check marks
// this purchase row only, never a receipt, pantry consumption or cooked meal.
export function shoppingRowIdentity(quote: Quote, row: Quote["rows"][number]): { itemKey: string; fingerprint: string } {
  const itemKey = hash(row.kind==="weight"?["weight",row.skuId,row.formDigest,row.unit]:[row.skuId, row.formDigest, row.unit]), pin = row.factId ? quote.factPins.find(value => value.id === row.factId)?.factSha256 : null;
  if (row.factId && !pin || isPurchasedQuoteRow(row) && !row.factId) invalid();
  if(row.kind==="weight")return {itemKey,fingerprint:hash(canonicalReferenceData({itemKey,kind:"weight",needed:row.needed,ownedUsed:row.ownedUsed,toBuy:row.toBuy,purchasedQuantity:row.purchasedQuantity,rate:row.rate,evidence:pin}))};
  return { itemKey, fingerprint: hash(canonicalReferenceData({ itemKey, needed: row.needed, ownedUsed: row.ownedUsed, toBuy: row.toBuy, packQuantity: row.packQuantity, packCount: row.packCount, evidence: pin })) };
}

export function reconcileShoppingChecks(quote: Quote, entriesValue: unknown): Reconciled | ErrorOutcome {
  try {
    const copied = copyReferenceData(entriesValue); if (!Array.isArray(copied) || copied.length > 1000) invalid();
    const entries = copied.map(entry), previous = new Map(entries.map(row => [row.itemKey, row])); if (previous.size !== entries.length) invalid();
    const rows: ShoppingCheck[] = [], invalidatedItemKeys: string[] = [], current = new Set<string>();
    for (const purchased of quote.rows.filter(isPurchasedQuoteRow)) {
      const identity = shoppingRowIdentity(quote, purchased), prior = previous.get(identity.itemKey);
      if (current.has(identity.itemKey)) invalid(); current.add(identity.itemKey);
      if (prior && prior.fingerprint !== identity.fingerprint) invalidatedItemKeys.push(identity.itemKey);
      rows.push({ ...identity, checked: prior?.fingerprint === identity.fingerprint ? prior.checked : false });
    }
    return freeze({ outcome: "reconciled", policy: "current-week-exact-row-only", rows: rows.sort((a, b) => order(a.itemKey, b.itemKey)), invalidatedItemKeys: invalidatedItemKeys.sort(order), removedItemKeys: entries.map(row => row.itemKey).filter(key => !current.has(key)).sort(order) });
  } catch { return { outcome: "error", code: "invalid_shopping_input" }; }
}

// Internal confirmed-transition utility, not an ingress/owner admission. Only
// the repository's V2 confirmed-replacement branch may carry purchase custody.
// Ordinary reconciliation and explicit shopping commands retain exact-row
// fingerprints, including needed/toBuy. No caller supplies a new bought flag.
export function rebindConfirmedPurchaseChecks(previousQuote: Quote, nextQuote: Quote, entriesValue: unknown):
  { readonly outcome: "rebound"; readonly rows: readonly ShoppingCheck[] } | ErrorOutcome | { readonly outcome: "held"; readonly code: "replacement_purchase_custody_changed" } {
  const held = () => ({ outcome: "held" as const, code: "replacement_purchase_custody_changed" as const });
  try {
    const before = copyReferenceData(previousQuote) as Quote, after = copyReferenceData(nextQuote) as Quote;
    const prior = reconcileShoppingChecks(before, entriesValue);
    if (prior.outcome !== "reconciled") return prior;
    if (prior.invalidatedItemKeys.length || prior.removedItemKeys.length) return { outcome: "error", code: "stale_shopping_row" };
    const context = (q: Quote) => canonicalReferenceData({ asOfDate: q.asOfDate, region: q.region, storeIds: q.storeIds, currency: q.currency });
    if (JSON.stringify(context(before)) !== JSON.stringify(context(after))) return held();
    const purchased = (q: Quote) => q.rows.filter(isPurchasedQuoteRow);
    const oldRows = purchased(before), newRows = purchased(after);
    if (oldRows.length > 1000 || oldRows.length !== newRows.length) return held();
    const amount = (v: Quote["rows"][number]["toBuy"]) => {
      if (!/^\d{1,100}$/.test(v.numerator) || !/^[1-9]\d{0,99}$/.test(v.denominator)) invalid();
      return { n: BigInt(v.numerator), d: BigInt(v.denominator) };
    };
    const commitment = (q: Quote, row: Quote["rows"][number]) => {
      const facts = q.factPins.filter(f => f.id === row.factId);
      if (!row.factId || facts.length !== 1) invalid();
      if(row.kind==="weight"){
       const quantity=amount(row.purchasedQuantity);if(quantity.n===BigInt(0)||Object.hasOwn(row,"packCount")||Object.hasOwn(row,"packQuantity"))invalid();
       if(hash(canonicalReferenceData(row.rate))!==facts[0]!.factSha256)invalid();
       return JSON.stringify(canonicalReferenceData({kind:"weight",skuId:row.skuId,formDigest:row.formDigest,unit:row.unit,purchasedQuantity:row.purchasedQuantity,rate:row.rate,evidence:facts[0],estimatedLineCents:row.estimatedLineCents}));
      }
      if(!Number.isSafeInteger(row.packCount)||row.packCount<=0)invalid();
      digest(facts[0]!.factSha256);
      if (!row.packQuantity) invalid();
      const pack = amount(row.packQuantity), quantity = amount(row.purchasedQuantity);
      if (pack.n === BigInt(0) || quantity.n * pack.d !== pack.n * BigInt(row.packCount) * quantity.d) invalid();
      return JSON.stringify(canonicalReferenceData({ skuId: row.skuId, formDigest: row.formDigest, unit: row.unit, packCount: row.packCount, packQuantity: row.packQuantity, purchasedQuantity: row.purchasedQuantity, factId: row.factId, evidence: facts[0], estimatedLineCents: row.estimatedLineCents }));
    };
    const oldByKey = new Map(oldRows.map(row => [shoppingRowIdentity(before, row).itemKey, row]));
    if (oldByKey.size !== oldRows.length) invalid();
    const checks = new Map(prior.rows.map(row => [row.itemKey, row]));
    const seen = new Set<string>(), rows: ShoppingCheck[] = [];
    for (const row of newRows) {
      const identity = shoppingRowIdentity(after, row), old = oldByKey.get(identity.itemKey);
      if (!old || seen.has(identity.itemKey)) return held(); seen.add(identity.itemKey);
      if (commitment(before, old) !== commitment(after, row)) return held();
      const demand = amount(row.toBuy), available = amount(old.purchasedQuantity);
      if (demand.n * available.d > available.n * demand.d) return held();
      const check = checks.get(identity.itemKey); if (!check) invalid();
      rows.push({ ...identity, checked: check.checked });
    }
    return freeze({ outcome: "rebound", rows: rows.sort((a, b) => order(a.itemKey, b.itemKey)) });
  } catch { return { outcome: "error", code: "invalid_shopping_input" }; }
}

export function setShoppingCheck(quote: Quote, entries: unknown, commandValue: unknown): { readonly outcome: "updated"; readonly rows: readonly ShoppingCheck[] } | ErrorOutcome {
  const current = reconcileShoppingChecks(quote, entries); if (current.outcome !== "reconciled") return current;
  let command: ShoppingCheck;
  try { command = entry(copyReferenceData(commandValue)); } catch { return { outcome: "error", code: "invalid_shopping_input" }; }
  const row = current.rows.find(row => row.itemKey === command.itemKey);
  if (!row) return { outcome: "error", code: "shopping_row_missing" };
  if (row.fingerprint !== command.fingerprint) return { outcome: "error", code: "stale_shopping_row" };
  return freeze({ outcome: "updated", rows: current.rows.map(row => row.itemKey === command.itemKey ? { ...row, checked: command.checked } : row) });
}
