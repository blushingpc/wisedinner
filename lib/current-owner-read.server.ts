import {FINAL_DERIVED_PIN} from "./generated-final-source-admission.ts";
import { admitVerifiedReferenceOwner, type OwnerScopeDependencies } from "./generated-owner-scope.ts";
import { createCurrentOwnerRpcStatePort, type CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { readReferenceJson, ReferenceBodyError } from "./generated-plan-json.ts";
import { sourcePolicyHashV2 } from "./generated-source-policy-basis-v2.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { reconcileShoppingChecks } from "./generated-plan-shopping.ts";
import { inspectPantryBasis } from "./generated-plan-pantry-basis.ts";
import { parsePeople } from "../packages/solver/src/generated-plan-contract.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { rational, receipt } from "../packages/solver/src/generated-meal-ranges.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { UUID } from "./generated-runtime-identity.ts";

// Server-only, source-independent READ boundary. It never evaluates a planner,
// asks for billing access, commits state or authorizes an old-source mutation.
export const CURRENT_OWNER_READ_CONTRACT = "wd-current-owner-read-v1";
type Data = Record<string, unknown>;
export type CurrentOwnerReadDependencies = Readonly<{ enabled: boolean; identity: OwnerScopeDependencies; rpc: CurrentOwnerRpcDriver }>;
const SHA = /^[a-f0-9]{64}$/;
const RESPONSE_LIMIT = 16 * 1024 * 1024;
class ReadRefusal extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
function fail(code = "stored_state_invalid"): never { throw new ReadRefusal(code); }
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) fail(); return value as Data; }
function fields(value: unknown, required: string[], optional: string[] = []): Data {
  const row = object(value);
  if (required.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !required.includes(key) && !optional.includes(key))) fail();
  return row;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) fail(); return value; }
function sha(value: unknown): string { const result = text(value); if (!SHA.test(result)) fail(); return result; }
function uuid(value: unknown): string { const result = text(value); if (!UUID.test(result)) fail(); return result; }
function integer(value: unknown, min = 0): number { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) >= Number.MAX_SAFE_INTEGER) fail(); return value as number; }
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function strings(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  const rows = value.map(text); if (new Set(rows).size !== rows.length) fail(); return rows;
}
function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) fail();
  return result;
}
function exact(value: unknown) {
  const row = fields(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof row[key] !== "string" || !/^(0|[1-9]\d*)$/.test(row[key] as string) || (row[key] as string).length > 120) fail();
  const result = rational(BigInt(row.numerator as string), BigInt(row.denominator as string));
  if (result.n <= BigInt(0)) fail(); return receipt(result);
}

// Mirrors the existing joined planner's request serialization, using its public
// person/quote parsers. Empty-demand quote parsing is NOT current price admission.
// Hashing the stored alphabetically ordered JSON directly would be incorrect:
// requestSha256 is the hash of this exact normalized producer field order.
function normalizedRequest(value: unknown, equipmentLimit: 50 | 100 = 50) {
  const row = fields(value, ["people", "selectedDays", "slots", "region", "storeIds", "budgetCents", "asOfDate", "equipment", "pantry"]);
  const parsed = parsePeople(row.people); if (parsed.outcome !== "validated") fail();
  const selectedDays = strings(row.selectedDays, 7).map(date).sort(order), slots = strings(row.slots, 3).sort(order), equipment = strings(row.equipment, equipmentLimit).sort(order);
  if (!selectedDays.length || !slots.length || slots.some(slot => !["breakfast", "lunch", "dinner"].includes(slot)) || Date.parse(selectedDays.at(-1)!) - Date.parse(selectedDays[0]!) > 6 * 86400000) fail();
  const checked = quoteRegionalEstimates({ region: row.region, storeIds: row.storeIds, budgetCents: row.budgetCents, asOfDate: row.asOfDate }, [], row.pantry, []);
  if (checked.outcome !== "quoted") fail();
  const people = parsed.people.map(person => person.preferences ? { ...person, preferences: { preferredRecipeIds: [...person.preferences.preferredRecipeIds].sort(order) } } : person).sort((a, b) => order(a.personId, b.personId));
  const pantry = checked.ownedRemaining.map(stock => ({ skuId: stock.skuId, unit: stock.unit, formDigest: stock.formDigest, quantity: { numerator: Number(stock.quantity.numerator), denominator: Number(stock.quantity.denominator) } }));
  return { people, selectedDays, slots, region: checked.region, storeIds: checked.storeIds, budgetCents: row.budgetCents as number, asOfDate: checked.asOfDate, equipment, pantry };
}
function assignments(value: unknown, request: ReturnType<typeof normalizedRequest>) {
  if (!Array.isArray(value) || !value.length || value.length > 168) fail();
  const ids = new Set<string>(), occupied = new Set<string>();
  const rows = value.map(value => {
    const row = fields(value, ["assignmentId", "personId", "profileRevision", "date", "slot", "recipeId", "recipeSha256", "sourceServings"]);
    const assignmentId = text(row.assignmentId), personId = text(row.personId), profileRevision = integer(row.profileRevision), day = date(row.date), slot = text(row.slot);
    const person = request.people.find(person => person.personId === personId), cell = JSON.stringify([personId, day, slot]);
    if (!person || person.profileRevision !== profileRevision || !request.selectedDays.includes(day) || !request.slots.includes(slot) || ids.has(assignmentId) || occupied.has(cell)) fail();
    ids.add(assignmentId); occupied.add(cell);
    return { assignmentId, personId, profileRevision, date: day, slot, recipeId: text(row.recipeId), recipeSha256: sha(row.recipeSha256), sourceServings: exact(row.sourceServings) };
  }).sort((a, b) => order(a.assignmentId, b.assignmentId));
  if (rows.length !== request.people.length * request.selectedDays.length * request.slots.length) fail();
  return rows;
}
function basis(value: unknown, source: string): Data {
  const row = fields(value, ["policy", "catalogSha256", "purchaseCorrespondencesSha256", "regionalPackFactsSha256", "referencePricePolicy", "referenceConfigurationSha256", "utilityPolicy", "utilityConfigurationSha256", "basisSha256"], ["documentaryValuationPolicy"]);
  if (row.policy !== "wd-source-policy-basis-v2" || row.catalogSha256 !== source) fail();
  for (const key of ["catalogSha256", "purchaseCorrespondencesSha256", "regionalPackFactsSha256", "basisSha256"]) sha(row[key]);
  for (const [policy, digest, expected] of [["referencePricePolicy", "referenceConfigurationSha256", "wd-price-reference-fallback-v2"], ["utilityPolicy", "utilityConfigurationSha256", "wd-tap-cooking-water-utility-v1"]]) {
    if (row[policy] === null ? row[digest] !== null : row[policy] !== expected || !SHA.test(String(row[digest]))) fail();
  }
  if (Object.hasOwn(row, "documentaryValuationPolicy") && (row.documentaryValuationPolicy !== "wd-dated-documentary-reference-v1" || row.referencePricePolicy === null)) fail();
  const { basisSha256, ...body } = row;
  if (sourcePolicyHashV2(["wd-source-policy-basis-v2", body]) !== basisSha256) fail();
  return row;
}
function money(value: unknown, signed = false) {
  const row = fields(value, ["min", "max"]);
  if (!Number.isSafeInteger(row.min) || !Number.isSafeInteger(row.max) || (!signed && (row.min as number) < 0) || (row.max as number) < (row.min as number)) fail();
  return { min: row.min as number, max: row.max as number };
}
function savedWeek(value: unknown): Data | null {
  if (value === null) return null;
  const row = fields(value, ["weekId", "request", "assignments", "sourceSha256", "requestSha256", "assignmentsSha256", "quote", "shoppingChecks", "contentSha256", "sourcePolicyBasis", "utilityPartition"], ["pantryBasis", "allergyBasisSha256", "newWeekPolicy"]);
  uuid(row.weekId); const source = sha(row.sourceSha256), checkedBasis = basis(row.sourcePolicyBasis, source);
  const { contentSha256, sourcePolicyBasis: ignoredBasis, utilityPartition, ...body } = row; void ignoredBasis;
  if ((utilityPartition === null) !== (checkedBasis.utilityPolicy === null) || sourcePolicyHashV2(["wd-joined-session-content-v2", hash(canonicalReferenceData(body)), checkedBasis.basisSha256, sourcePolicyHashV2(utilityPartition)]) !== sha(contentSha256)) fail();
  const request = normalizedRequest(row.request, source === FINAL_DERIVED_PIN.sha256 ? 100 : 50), selected = assignments(row.assignments, request);
  if (hash(request) !== sha(row.requestSha256) || hash(selected) !== sha(row.assignmentsSha256)) fail();
  if (Object.hasOwn(row, "pantryBasis")) { if (inspectPantryBasis(row.pantryBasis, object(row.request).pantry).outcome !== "ready") fail(); }
  else if (request.pantry.length) fail("pantry_provenance_migration_required");
  if (Object.hasOwn(row, "allergyBasisSha256")) sha(row.allergyBasisSha256);
  if (Object.hasOwn(row, "newWeekPolicy")) {
    const policy = fields(row.newWeekPolicy, ["version", "pantrySha256"], ["pantryBasisSha256", "currentSettingsSha256"]);
    if (policy.version !== "wd-new-week-reconfirm-v1" || policy.pantrySha256 !== hash(canonicalReferenceData(object(row.request).pantry)) || (row.pantryBasis && policy.pantryBasisSha256 !== object(row.pantryBasis).basisSha256)) fail();
    if (Object.hasOwn(policy, "currentSettingsSha256")) sha(policy.currentSettingsSha256);
  }
  const quote = object(row.quote), shopping = object(row.shoppingChecks);
  if (quote.outcome !== "quoted" || quote.currency !== "USD" || quote.liveRetailerPricing !== false || quote.region !== request.region || quote.asOfDate !== request.asOfDate || hash(quote.storeIds) !== hash(request.storeIds)) fail();
  if (shopping.status === "ready") {
    fields(shopping, ["status", "rows"]);
    const check = reconcileShoppingChecks(quote as never, shopping.rows);
    if (check.outcome !== "reconciled" || hash(canonicalReferenceData(check.rows)) !== hash(canonicalReferenceData(shopping.rows))) fail("stored_checklist_mismatch");
  } else if (shopping.status !== "held" || fields(shopping, ["status", "code"]).code !== "new_week_carry_policy_required") fail();
  const total = money(quote.estimatedTotalCents), remaining = money(quote.budgetRemainingCents, true);
  if (remaining.min !== request.budgetCents - total.max || remaining.max !== request.budgetCents - total.min) fail();
  // Whitelist only. No raw quote, fact/price rows, provider receipts, URLs or
  // arbitrary stored error objects are copied into a customer response.
  return { weekId: row.weekId, sourceSha256: source, requestSha256: row.requestSha256, assignmentsSha256: row.assignmentsSha256, contentSha256,
    request: copyReferenceData(row.request), assignments: copyReferenceData(row.assignments), sourcePolicyBasisSha256: checkedBasis.basisSha256,
    pantryBasisSha256: row.pantryBasis ? object(row.pantryBasis).basisSha256 : null, allergyBasisSha256: row.allergyBasisSha256 ?? null,
    utilityPartitionSha256: sourcePolicyHashV2(utilityPartition), shoppingChecks: copyReferenceData(row.shoppingChecks),
    groceries: { estimatedTotalCents: total, budgetRemainingCents: remaining, uniqueBuyItemCount: integer(quote.uniqueBuyItemCount), currency: "USD", region: quote.region, storeIds: quote.storeIds, asOfDate: quote.asOfDate, liveRetailerPricing: false, checkoutChargesIncluded: false, estimateDisclosure: "stored-whole-pack-estimate-not-current-store-prices", referenceEstimatesIncluded: Object.hasOwn(quote, "referenceEstimates") },
    view: { outcome: "held", code: "original_source_render_not_evaluated" } };
}
function savedState(value: unknown) {
  if (value === null) return { revision: 0, current: null, draft: null };
  const row = fields(value, ["revision", "current", "draft"]), current = savedWeek(row.current), draft = savedWeek(row.draft);
  if (draft && (!current || draft.weekId === current.weekId)) fail();
  return { revision: integer(row.revision), current, draft };
}
function originalSource(value: unknown, targetOperationId: string, digest: string): string {
  const row = fields(value, ["contract", "operation", "operationId", "sourceSha256", "payload", "expectedSourcePolicyBasisSha256", "intentSha256"]);
  if (row.contract !== "wd-joined-session-proposal-v2" || !["installCurrent", "saveCurrent", "createWeekDraft", "cancelWeekDraft", "confirmNewWeek", "shoppingCheck", "saveReplacement"].includes(String(row.operation)) || row.operationId !== targetOperationId || row.intentSha256 !== digest) fail("original_intent_mismatch");
  const { intentSha256: ignored, ...intent } = row; void ignored;
  if (referenceOperationDigest(intent) !== digest) fail("original_intent_mismatch");
  object(row.payload); if (row.expectedSourcePolicyBasisSha256 !== null) sha(row.expectedSourcePolicyBasisSha256);
  return sha(row.sourceSha256);
}

export function createCurrentOwnerReadService(dependencies: CurrentOwnerReadDependencies) {
  const { enabled, identity, rpc } = dependencies;
  return async (request: Request): Promise<Response> => {
    let requestId: string | null = null, operation: string | null = null, ownerScopeSha256: string | null = null;
    let known: Data = {};
    const respond = (result: Data, status = 200) => {
      const envelope = (result: Data) => ({ contract: CURRENT_OWNER_READ_CONTRACT, requestId, operation, ownerScopeSha256, apiAccepted: false, productionReady: false, result });
      let body = JSON.stringify(envelope(result));
      if (Buffer.byteLength(body) > RESPONSE_LIMIT) { status = 413; body = JSON.stringify(envelope({ outcome: "held", code: "response_capacity_exceeded", ...known, statusRequired: true })); }
      return new Response(body, { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    };
    if (!enabled) return respond({ outcome: "held", code: "current_owner_read_disabled" }, 503);
    if (request.method !== "POST") return respond({ outcome: "error", code: "method_not_allowed" }, 405);
    let input: Data;
    try {
      input = object(await readReferenceJson(request));
      requestId = uuid(input.requestId); operation = text(input.operation);
      if (input.contract !== CURRENT_OWNER_READ_CONTRACT) return respond({ outcome: "error", code: "contract_mismatch" }, 409);
      if (operation === "metadata") {
        fields(input, ["contract", "operation", "requestId", "target"], ["expectedStateRevision"]);
        if (!["current", "draft"].includes(String(input.target))) fail();
        if (Object.hasOwn(input, "expectedStateRevision")) integer(input.expectedStateRevision);
      } else if (operation === "operationStatus") {
        fields(input, ["contract", "operation", "requestId", "targetOperationId", "targetIntentSha256"], ["originalEnvelope"]);
        uuid(input.targetOperationId); sha(input.targetIntentSha256);
        if (Object.hasOwn(input, "originalEnvelope")) originalSource(input.originalEnvelope, input.targetOperationId as string, input.targetIntentSha256 as string);
      } else fail();
    } catch (error) {
      const code = error instanceof ReferenceBodyError ? error.code : "invalid_read_request";
      return respond({ outcome: "error", code }, code === "body_capacity_exceeded" ? 413 : code === "request_aborted" ? 499 : 400);
    }
    const owner = await admitVerifiedReferenceOwner(request, identity);
    if (owner.outcome !== "ready") return respond(owner, owner.outcome === "denied" ? 403 : 503);
    ownerScopeSha256 = owner.storageKey;
    try {
      const port = createCurrentOwnerRpcStatePort(rpc, owner);
      const result = await port.transaction(async tx => {
        if (operation === "metadata") {
          const state = savedState(await tx.readState(owner.storageKey));
          if (input.expectedStateRevision !== undefined && input.expectedStateRevision !== state.revision) return { outcome: "held", code: "stale_read", stateRevision: state.revision };
          return { outcome: "metadata", stateRevision: state.revision, target: input.target, week: input.target === "current" ? state.current : state.draft };
        }
        const stored = await tx.readOperation(owner.storageKey, input.targetOperationId as string);
        if (!stored) return { outcome: "operation_status", disposition: "unresolved", operationId: input.targetOperationId, intentSha256: input.targetIntentSha256, sourceBinding: { status: "unavailable" }, statusRequired: true, retryAuthorized: false };
        if (stored.intentSha256 !== input.targetIntentSha256) fail("original_intent_mismatch");
        const receipt = stored.receipt;
        // Keep original disposition even if decoding/render/capacity later holds.
        known = { operationId: stored.operationId, intentSha256: stored.intentSha256, saved: receipt.outcome === "acknowledged", disposition: receipt.outcome === "acknowledged" ? "acknowledged" : "not_applied", retryAuthorized: false };
        if (receipt.outcome === "acknowledged") {
          const state = savedState(receipt.state), weeks = [state.current, state.draft].filter((v): v is Data => !!v);
          if (!weeks.some(week => week.sourcePolicyBasisSha256 === receipt.committedSourcePolicyBasisSha256)) fail("stored_receipt_invalid");
          const sources = [...new Set(weeks.filter(week => week.sourcePolicyBasisSha256 === receipt.committedSourcePolicyBasisSha256).map(week => week.sourceSha256))];
          if (sources.length !== 1) fail("source_binding_unavailable");
          if (input.originalEnvelope && originalSource(input.originalEnvelope, stored.operationId, stored.intentSha256) !== sources[0]) fail("original_source_mismatch");
          return { outcome: "operation_status", ...known, state, sourceBinding: { status: "stored", sourceSha256: sources[0], committedSourcePolicyBasisSha256: receipt.committedSourcePolicyBasisSha256 } };
        }
        const rejection = object(receipt.result);
        if (!["no_fit", "held", "error"].includes(String(rejection.outcome))) fail("stored_receipt_invalid");
        const source = input.originalEnvelope ? originalSource(input.originalEnvelope, stored.operationId, stored.intentSha256) : null;
        return { outcome: "operation_status", ...known, originalResult: { outcome: rejection.outcome, detailsHeld: true }, sourceBinding: source ? { status: "verified-original-envelope", sourceSha256: source } : { status: "unavailable", code: "source_binding_unavailable" } };
      });
      // Auth/account may have changed while a read was in flight. Re-admit the
      // exact request; never return A's data after a trusted adapter becomes B.
      const after = await admitVerifiedReferenceOwner(request, identity);
      if (after.outcome !== "ready" || after.ownerId !== owner.ownerId || after.accountRevision !== owner.accountRevision || after.storageKey !== owner.storageKey) return respond({ outcome: "held", code: "owner_changed_during_read" }, 409);
      if (request.signal.aborted) return respond({ outcome: "error", code: "request_aborted", ...known }, 499);
      return respond(result);
    } catch (error) {
      const after = await admitVerifiedReferenceOwner(request, identity);
      if (after.outcome !== "ready" || after.ownerId !== owner.ownerId || after.accountRevision !== owner.accountRevision || after.storageKey !== owner.storageKey) return respond({ outcome: "held", code: "owner_changed_during_read" }, 409);
      return respond({ outcome: "held", code: error instanceof ReadRefusal ? error.code : "owner_read_unavailable", ...known, statusRequired: operation === "operationStatus" }, 409);
    }
  };
}
