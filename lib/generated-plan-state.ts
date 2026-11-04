import type {JoinedReferenceBindingV3,ReferenceEvaluationSuccessV3} from "./generated-joined-plan.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { utf8ByteLength } from "./generated-runtime-bytes.ts";
import { reconcileShoppingChecks, rebindConfirmedPurchaseChecks, setShoppingCheck, type ShoppingCheck, type ShoppingCheckState } from "./generated-plan-shopping.ts";
import { UUID } from "./generated-runtime-identity.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import type { JoinedReferenceBinding, ReferencePlanOutcome, ReferenceEvaluationSuccess } from "./generated-joined-plan.ts";
import type { JoinedReferenceBindingV2, ReferenceEvaluationSuccessV2 } from "./generated-joined-plan.ts";
import { sourcePolicyHashV2, type SourcePolicyBasisV2 } from "./generated-source-policy-basis-v2.ts";
import { inspectPantryBasis, revalidatePantryBasis, type ReferencePantryBasis } from "./generated-plan-pantry-basis.ts";
import type { NewWeekRequestPolicy } from "./generated-source-clock.ts";

// Injected local-reference protocol only. No database, route, account provider or
// native storage is installed. A real port must be serializable and atomic over
// state AND receipts, with rollback on rejection. In-memory tests do not prove it.
type Planner = Extract<JoinedReferenceBinding, { outcome: "ready" }>["planner"];
export const NEW_WEEK_RECONFIRM_POLICY = "wd-new-week-reconfirm-v1";
declare const localScopeBrand: unique symbol;
export type LocalReferenceScope = { readonly [localScopeBrand]: true };
type ScopeInfo = { key: string; namespace: string; generation: number; active: boolean; version: 1 | 2; generationKey: string };
const scopes = new WeakMap<object, ScopeInfo>(), generations = new Map<string, number>();
const v2Generations = new Map<string, number>();
export type ReferenceWeek = {
  readonly weekId: string; readonly request: unknown; readonly assignments: unknown;
  readonly sourceSha256: string; readonly requestSha256: string; readonly assignmentsSha256: string;
  readonly quote: ReferenceEvaluationSuccess["quote"]; readonly shoppingChecks: ShoppingCheckState; readonly contentSha256: string;
  readonly pantryBasis?: ReferencePantryBasis;
  readonly allergyBasisSha256?: string;
  readonly newWeekPolicy?: { readonly version: typeof NEW_WEEK_RECONFIRM_POLICY; readonly pantrySha256: string; readonly pantryBasisSha256?: string; readonly currentSettingsSha256?: string };
};
export type ReferenceEnvelope = { readonly revision: number; readonly current: ReferenceWeek | null; readonly draft: ReferenceWeek | null };
type AcceptedReceipt = { readonly outcome: "acknowledged"; readonly operationId: string; readonly state: ReferenceEnvelope };
type RejectedReceipt = { readonly outcome: "not_applied"; readonly operationId: string; readonly result: Exclude<ReferencePlanOutcome, { outcome: "success" }> };
type Receipt = AcceptedReceipt | RejectedReceipt;
export type StoredReferenceOperation = { readonly operationId: string; readonly intentSha256: string; readonly receipt: Receipt };
export type ReferenceStatePort = {
  transaction<T>(body: (tx: {
    readState(scopeKey: string): Promise<ReferenceEnvelope | null>;
    readOperation(scopeKey: string, operationId: string): Promise<StoredReferenceOperation | null>;
    commit(scopeKey: string, state: ReferenceEnvelope, operation: StoredReferenceOperation): Promise<void>;
  }) => Promise<T>): Promise<T>;
};

export type ReferenceWeekV2 = Omit<ReferenceWeek, "quote"> & Pick<ReferenceEvaluationSuccessV2, "quote" | "sourcePolicyBasis" | "utilityPartition">;
export type ReferenceEnvelopeV2 = { readonly revision: number; readonly current: ReferenceWeekV2 | null; readonly draft: ReferenceWeekV2 | null };
type ReceiptV2 = { readonly outcome: "acknowledged"; readonly operationId: string; readonly state: ReferenceEnvelopeV2; readonly committedSourcePolicyBasisSha256: string } | RejectedReceipt;
export type StoredReferenceOperationV2 = { readonly operationId: string; readonly intentSha256: string; readonly receipt: ReceiptV2 };
export type ReferenceStatePortV2 = { transaction<T>(body: (tx: {
  readState(scopeKey: string): Promise<ReferenceEnvelopeV2 | null>;
  readOperation(scopeKey: string, operationId: string): Promise<StoredReferenceOperationV2 | null>;
  commit(scopeKey: string, state: ReferenceEnvelopeV2, operation: StoredReferenceOperationV2): Promise<void>;
}) => Promise<T>): Promise<T> };
type V2Result<T> = T extends AcceptedReceipt ? Extract<ReceiptV2, { outcome: "acknowledged" }> : T extends ReferenceWeek ? ReferenceWeekV2 : T extends readonly (infer E)[] ? readonly V2Result<E>[] : T extends object ? { [K in keyof T]: V2Result<T[K]> } : T;
type RepositoryV2 = { [K in keyof ReturnType<typeof createReferencePlanRepository>]: ReturnType<typeof createReferencePlanRepository>[K] extends (...args: infer A) => Promise<infer O> ? (...args: A) => Promise<V2Result<O>> : never };
export type ReferenceWeekV3=Omit<ReferenceWeekV2,"quote">&Pick<ReferenceEvaluationSuccessV3,"quote">;
export type ReferenceEnvelopeV3={readonly revision:number;readonly current:ReferenceWeekV3|null;readonly draft:ReferenceWeekV3|null};
type V3Result<T>=T extends ReferenceWeekV2?ReferenceWeekV3:T extends readonly(infer E)[]?readonly V3Result<E>[]:T extends object?{[K in keyof T]:V3Result<T[K]>}:T;
export type RepositoryV3={[K in keyof RepositoryV2]:RepositoryV2[K] extends (...args:infer A)=>Promise<infer O>?(...args:A)=>Promise<V3Result<O>>:never};
export type ReferenceStatePortV3={transaction<T>(body:(tx:{readState(scopeKey:string):Promise<ReferenceEnvelopeV3|null>;readOperation(scopeKey:string,operationId:string):Promise<V3Result<StoredReferenceOperationV2>|null>;commit(scopeKey:string,state:ReferenceEnvelopeV3,operation:V3Result<StoredReferenceOperationV2>):Promise<void>})=>Promise<T>):Promise<T>};
function contentDigest(body: Record<string, unknown>, version: 1 | 2): string {
  if (version === 1) return hash(copy(body));
  const { sourcePolicyBasis, utilityPartition, ...base } = body;
  return sourcePolicyHashV2(["wd-joined-session-content-v2", hash(copy(base)), (sourcePolicyBasis as SourcePolicyBasisV2).basisSha256, sourcePolicyHashV2(utilityPartition)]);
}
function validateSourcePolicyBasis(value: unknown): SourcePolicyBasisV2 {
  const hasDocumentaryPolicy = value !== null && typeof value === "object" && Object.hasOwn(value, "documentaryValuationPolicy");
  const fields = record(value, ["policy", "catalogSha256", "purchaseCorrespondencesSha256", "regionalPackFactsSha256", "referencePricePolicy", "referenceConfigurationSha256", "utilityPolicy", "utilityConfigurationSha256", "basisSha256", ...(hasDocumentaryPolicy ? ["documentaryValuationPolicy"] : [])]);
  const { basisSha256, ...body } = fields;
  if (fields.policy !== "wd-source-policy-basis-v2" || ![null, "wd-price-reference-fallback-v2"].includes(fields.referencePricePolicy as null) || ![null, "wd-tap-cooking-water-utility-v1"].includes(fields.utilityPolicy as null)) refuse("stored_state_invalid");
  if (hasDocumentaryPolicy && (fields.documentaryValuationPolicy !== "wd-dated-documentary-reference-v1" || fields.referencePricePolicy !== "wd-price-reference-fallback-v2")) refuse("stored_state_invalid");
  for (const key of ["catalogSha256", "purchaseCorrespondencesSha256", "regionalPackFactsSha256", "basisSha256"]) if (typeof fields[key] !== "string" || !/^[a-f0-9]{64}$/.test(fields[key] as string)) refuse("stored_state_invalid");
  for (const [policy, digest] of [["referencePricePolicy", "referenceConfigurationSha256"], ["utilityPolicy", "utilityConfigurationSha256"]]) if (fields[policy!] === null ? fields[digest!] !== null : typeof fields[digest!] !== "string" || !/^[a-f0-9]{64}$/.test(fields[digest!] as string)) refuse("stored_state_invalid");
  if (sourcePolicyHashV2(["wd-source-policy-basis-v2", body]) !== basisSha256) refuse("stored_state_invalid");
  return fields as SourcePolicyBasisV2;
}

type ErrorOutcome = { readonly outcome: "error"; readonly code: string };
type HeldOutcome = { readonly outcome: "held"; readonly code: string };
type MutationOutcome = Receipt | ErrorOutcome | HeldOutcome | { readonly outcome: "unknown"; readonly operationId: string; readonly statusRequired: true };
type OriginalLookupV2 = (scope: LocalReferenceScope, id: unknown, digest: unknown) => Promise<Receipt | ErrorOutcome | HeldOutcome | null>;
const originalLookupsV2 = new WeakMap<object, OriginalLookupV2>();
export async function resolveOriginalReferenceOperationV2(repository: object, scope: LocalReferenceScope, id: unknown, digest: unknown) {
  const lookup = originalLookupsV2.get(repository);
  return lookup ? lookup(scope, id, digest) : { outcome: "error", code: "state_binding_required" } as const;
}
type Data = Record<string, unknown>;
class Refusal extends Error {
  readonly code: string; readonly held: boolean;
  constructor(code: string, held = false) { super("Reference state refused"); this.code = code; this.held = held; }
}
function refuse(code: string, held = false): never { throw new Refusal(code, held); }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) refuse("invalid_state_command"); return value; }
function uuid(value: unknown): string { const result = text(value); if (!UUID.test(result)) refuse("invalid_state_command"); return result; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) >= Number.MAX_SAFE_INTEGER) refuse("invalid_revision"); return value as number; }
function record(value: unknown, fields: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...fields].sort().join("|")) refuse("invalid_state_command");
  return value as Data;
}
function copy(value: unknown): unknown {
  try {
    const copied = canonicalReferenceData(value);
  if (utf8ByteLength(JSON.stringify(copied)) > 8 * 1024 * 1024) refuse("state_capacity_review_required", true);
    return copied;
  } catch (error) {
    if (error instanceof Refusal) throw error;
    return refuse("invalid_state_command");
  }
}
function error(error: Refusal): ErrorOutcome | HeldOutcome { return error.held ? { outcome: "held", code: error.code } : { outcome: "error", code: error.code }; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function activeScope(scope: LocalReferenceScope, version: 1 | 2 = 1): ScopeInfo {
  const bound = scope && typeof scope === "object" ? scopes.get(scope) : undefined;
  if (!bound || !bound.active || bound.version !== version || (version === 1 ? generations : v2Generations).get(bound.generationKey) !== bound.generation) refuse("local_scope_inactive");
  return bound;
}
// Trusted installation/session adapter only, never a JSON/body account claim.
// The host owns namespace identity and persistent generation verification; this
// process-local handle is not hosted Auth, RLS or cross-process revocation.
export function issueLocalReferenceScope(namespaceValue: string, generationValue: number): LocalReferenceScope { return issueScope(namespaceValue, generationValue, 1); }
export function issueLocalReferenceScopeV2(namespaceValue: string, generationValue: number): LocalReferenceScope { return issueScope(namespaceValue, generationValue, 2); }
function issueScope(namespaceValue: string, generationValue: number, version: 1 | 2): LocalReferenceScope {
  const namespace = text(namespaceValue), generation = revision(generationValue), generationKey = namespace, generationStore = version === 1 ? generations : v2Generations, previous = generationStore.get(generationKey);
  if (previous !== undefined && generation < previous) refuse("stale_local_generation");
  generationStore.set(generationKey, generation);
  const scope = Object.freeze({}) as LocalReferenceScope;
  scopes.set(scope, { key: version === 1 ? hash({ namespace }) : hash({ protocol: "joined-session-v2", namespace }), namespace, generation, active: true, version, generationKey }); return scope;
}
export function revokeLocalReferenceScope(scope: LocalReferenceScope): void { const value = scopes.get(scope); if (value) value.active = false; }
function week(value: unknown, version: 1 | 2 = 1): ReferenceWeek | null {
  if (value === null) return null;
  if (value && typeof value === "object" && !Object.hasOwn(value, "shoppingChecks")) refuse("reference_checklist_migration_required", true);
  const fields = record(value, ["weekId", "request", "assignments", "sourceSha256", "requestSha256", "assignmentsSha256", "quote", "shoppingChecks", "contentSha256", ...(version === 2 ? ["sourcePolicyBasis", "utilityPartition"] : []), ...(value && typeof value === "object" && Object.hasOwn(value, "newWeekPolicy") ? ["newWeekPolicy"] : []), ...(value && typeof value === "object" && Object.hasOwn(value, "pantryBasis") ? ["pantryBasis"] : []), ...(value && typeof value === "object" && Object.hasOwn(value, "allergyBasisSha256") ? ["allergyBasisSha256"] : [])]);
  uuid(fields.weekId);
  if (Object.hasOwn(fields, "allergyBasisSha256") && (typeof fields.allergyBasisSha256 !== "string" || !/^[a-f0-9]{64}$/.test(fields.allergyBasisSha256))) refuse("stored_state_invalid");
  const { contentSha256, ...body } = fields;
  if (version === 2) { const basis = validateSourcePolicyBasis(fields.sourcePolicyBasis); if (basis.catalogSha256 !== fields.sourceSha256 || fields.utilityPartition === undefined || (fields.utilityPartition === null) !== (basis.utilityPolicy === null)) refuse("stored_state_invalid"); }
  if (contentDigest(body, version) !== contentSha256) refuse("stored_state_invalid");
  const stock = (fields.request as Data)?.pantry;
  if (!Array.isArray(stock)) refuse("stored_state_invalid");
  if (Object.hasOwn(fields, "pantryBasis")) {
    const inspected = inspectPantryBasis(fields.pantryBasis, stock);
    if (inspected.outcome !== "ready") refuse(inspected.code);
  } else if (stock.length) refuse("pantry_provenance_migration_required", true);
  if (Object.hasOwn(fields, "newWeekPolicy")) {
    const policy = record(fields.newWeekPolicy, ["version", "pantrySha256", ...(Object.hasOwn(fields, "pantryBasis") ? ["pantryBasisSha256"] : []), ...(fields.newWeekPolicy && typeof fields.newWeekPolicy === "object" && Object.hasOwn(fields.newWeekPolicy, "currentSettingsSha256") ? ["currentSettingsSha256"] : [])]);
    if (policy.version !== NEW_WEEK_RECONFIRM_POLICY || policy.pantrySha256 !== hash(copy((fields.request as Data)?.pantry))) refuse("stored_state_invalid");
    if (Object.hasOwn(fields, "pantryBasis") && policy.pantryBasisSha256 !== (fields.pantryBasis as ReferencePantryBasis).basisSha256) refuse("stored_pantry_basis_invalid");
    if (Object.hasOwn(policy, "currentSettingsSha256") && (typeof policy.currentSettingsSha256 !== "string" || !/^[a-f0-9]{64}$/.test(policy.currentSettingsSha256))) refuse("stored_state_invalid");
  }
  const shopping = fields.shoppingChecks as ShoppingCheckState;
  if (shopping?.status === "ready") {
    record(shopping, ["status", "rows"]);
    const checked = reconcileShoppingChecks(fields.quote as ReferenceWeek["quote"], shopping.rows);
    if (checked.outcome !== "reconciled" || hash(copy(checked.rows)) !== hash(copy(shopping.rows))) refuse("stored_checklist_mismatch");
  } else if (shopping?.status === "held") {
    record(shopping, ["status", "code"]); if (shopping.code !== "new_week_carry_policy_required") refuse("stored_checklist_mismatch");
  } else refuse("stored_checklist_mismatch");
  return fields as ReferenceWeek;
}
function decodeEnvelope(value: unknown, version: 1 | 2 = 1): ReferenceEnvelope {
  if (value === null) return { revision: 0, current: null, draft: null };
  const fields = record(copy(value), ["revision", "current", "draft"]), current = week(fields.current, version), draft = week(fields.draft, version);
  if (draft && (!current || draft.weekId === current.weekId)) refuse("stored_state_invalid");
  return { revision: revision(fields.revision), current, draft };
}
function decodeReceipt(value: unknown, version: 1 | 2 = 1): Receipt {
  const copied = copy(value) as Data;
  if (copied?.outcome === "acknowledged") {
    const fields = record(copied, ["outcome", "operationId", "state", ...(version === 2 ? ["committedSourcePolicyBasisSha256"] : [])]);
    if (version === 2 && (typeof fields.committedSourcePolicyBasisSha256 !== "string" || !/^[a-f0-9]{64}$/.test(fields.committedSourcePolicyBasisSha256))) refuse("stored_receipt_invalid");
    return { outcome: "acknowledged", operationId: uuid(fields.operationId), state: decodeEnvelope(fields.state, version), ...(version === 2 ? { committedSourcePolicyBasisSha256: fields.committedSourcePolicyBasisSha256 as string } : {}) };
  }
  if (copied?.outcome === "not_applied") {
    const fields = record(copied, ["outcome", "operationId", "result"]), result = fields.result as Exclude<ReferencePlanOutcome, { outcome: "success" }>;
    if (!result || !["no_fit", "held", "error"].includes(result.outcome)) refuse("stored_receipt_invalid");
    return { outcome: "not_applied", operationId: uuid(fields.operationId), result };
  }
  return refuse("stored_receipt_invalid");
}
function decodeOperation(value: unknown, version: 1 | 2 = 1): StoredReferenceOperation | null {
  if (value === null) return null;
  const fields = record(copy(value), ["operationId", "intentSha256", "receipt"]), id = uuid(fields.operationId), checked = decodeReceipt(fields.receipt, version);
  if (id !== checked.operationId || typeof fields.intentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(fields.intentSha256)) refuse("stored_receipt_invalid");
  return { operationId: id, intentSha256: fields.intentSha256, receipt: checked };
}
function encodeWeek(weekId: string, input: Data, result: ReferenceEvaluationSuccess, previousChecks: readonly ShoppingCheck[] | null, version: 1 | 2 = 1): ReferenceWeek {
  const assignments = result.projection.assignments.map(({ assignmentId, personId, profileRevision, date, slot, recipeId, recipeSha256, sourceServings }) => ({ assignmentId, personId, profileRevision, date, slot, recipeId, recipeSha256, sourceServings }));
  const reconciled = previousChecks === null ? null : reconcileShoppingChecks(result.quote, previousChecks);
  if (reconciled && reconciled.outcome !== "reconciled") refuse("invalid_shopping_input");
  const shoppingChecks: ShoppingCheckState = reconciled ? { status: "ready", rows: reconciled.rows } : { status: "held", code: "new_week_carry_policy_required" };
  if (result.allergyBasisSha256 !== undefined && !/^[a-f0-9]{64}$/.test(result.allergyBasisSha256)) refuse("invalid_evaluated_allergy_basis");
  const body = { weekId, request: input.request, assignments, sourceSha256: result.sourceSha256, requestSha256: result.requestSha256, assignmentsSha256: result.assignmentsSha256, quote: result.quote, shoppingChecks, ...(version === 2 ? { sourcePolicyBasis: (result as unknown as ReferenceEvaluationSuccessV2).sourcePolicyBasis, utilityPartition: (result as unknown as ReferenceEvaluationSuccessV2).utilityPartition } : {}), ...(result.allergyBasisSha256 ? { allergyBasisSha256: result.allergyBasisSha256 } : {}), ...(Object.hasOwn(input, "pantryBasis") ? { pantryBasis: input.pantryBasis as ReferencePantryBasis } : {}) };
  return { ...body, contentSha256: contentDigest(body, version) };
}
function currentChecks(week: ReferenceWeek): readonly ShoppingCheck[] { if (week.shoppingChecks.status !== "ready") refuse("current_checklist_policy_required", true); return week.shoppingChecks.rows; }
function dates(saved: ReferenceWeek): string[] { return [...new Set((saved.assignments as { date: string }[]).map(value => value.date))].sort(); }
function settingsDigest(request: unknown): string {
  const data = request as Data, people = copy(data.people) as Data[], equipment = copy(data.equipment) as string[];
  if (!Array.isArray(people) || !Array.isArray(equipment)) refuse("stored_state_invalid");
  people.sort((a, b) => text(a.personId) < text(b.personId) ? -1 : text(a.personId) > text(b.personId) ? 1 : 0); equipment.sort();
  return hash(copy({ people, region: data.region, storeIds: data.storeIds, equipment, budgetCents: data.budgetCents, slots: [...(data.slots as string[])].sort() }));
}

export function createReferencePlanRepository(deps: { planner: Planner; transactions: ReferenceStatePort; newWeekPolicy?: typeof NEW_WEEK_RECONFIRM_POLICY }) {
  return createRepository(deps, 1);
}
export function createReferencePlanRepositoryV2(deps: { planner: Extract<JoinedReferenceBindingV2, { outcome: "ready" }>["planner"]; sourcePolicyBasis: SourcePolicyBasisV2; transactions: ReferenceStatePortV2; newWeekPolicy?: typeof NEW_WEEK_RECONFIRM_POLICY; newWeekRequestPolicy?: NewWeekRequestPolicy }): RepositoryV2 {
  // Private shared arithmetic helpers consume common fields; V2 codecs and
  // namespace are selected independently and never fed through a V1 decoder.
  return createRepository(deps as unknown as { planner: Planner; transactions: ReferenceStatePort; newWeekPolicy?: typeof NEW_WEEK_RECONFIRM_POLICY; sourcePolicyBasis: SourcePolicyBasisV2; newWeekRequestPolicy?: NewWeekRequestPolicy }, 2) as unknown as RepositoryV2;
}
export function createReferencePlanRepositoryV3(deps:{planner:Extract<JoinedReferenceBindingV3,{outcome:"ready"}>["planner"];sourcePolicyBasis:SourcePolicyBasisV2;transactions:ReferenceStatePortV3;newWeekPolicy?:typeof NEW_WEEK_RECONFIRM_POLICY;newWeekRequestPolicy?:NewWeekRequestPolicy}):RepositoryV3 {
 // Same original operation/owner/epoch engine and V2 durable codec. V3 changes only the typed quote row family.
 return createRepository(deps as unknown as Parameters<typeof createRepository>[0],2) as unknown as RepositoryV3;
}
function createRepository(deps: { planner: Planner; transactions: ReferenceStatePort; newWeekPolicy?: typeof NEW_WEEK_RECONFIRM_POLICY; sourcePolicyBasis?: SourcePolicyBasisV2; newWeekRequestPolicy?: NewWeekRequestPolicy }, version: 1 | 2) {
  const sourcePolicyBasis = version === 2 ? validateSourcePolicyBasis(copy(deps.sourcePolicyBasis)) : null;
  const active = (scope: LocalReferenceScope) => activeScope(scope, version);
  const envelope = (value: unknown) => decodeEnvelope(value, version);
  const receipt = (value: unknown) => decodeReceipt(value, version);
  const operation = (value: unknown) => decodeOperation(value, version);
  const saveWeek = (id: string, input: Data, result: ReferenceEvaluationSuccess, checks: readonly ShoppingCheck[] | null) => encodeWeek(id, input, result, checks, version);
  function requireCurrentBasis(saved: ReferenceWeek | null) {
    if (version === 2 && saved && (saved as unknown as ReferenceWeekV2).sourcePolicyBasis.basisSha256 !== sourcePolicyBasis!.basisSha256) refuse("saved_source_policy_basis_changed", true);
  }
  if (typeof deps?.planner?.evaluateJoined !== "function" || typeof deps?.planner?.confirmReplacement !== "function" || typeof deps?.transactions?.transaction !== "function") refuse("state_binding_required");
  if (deps.newWeekPolicy !== undefined && deps.newWeekPolicy !== NEW_WEEK_RECONFIRM_POLICY) refuse("invalid_new_week_policy");
  const newWeekPolicy = deps.newWeekPolicy;
  function currentPantry(input: { readonly request: unknown; readonly pantryBasis?: unknown }) {
    const stock = (input.request as Data)?.pantry;
    if (!Array.isArray(stock)) refuse("invalid_state_command");
    if (Object.hasOwn(input, "pantryBasis")) {
      const checked = revalidatePantryBasis(deps.planner.preparePantry, input.pantryBasis, stock);
      if (checked.outcome !== "ready") refuse(checked.code, checked.outcome === "held");
    } else if (stock.length) refuse("pantry_provenance_migration_required", true);
  }
  function currentAllergies(saved: ReferenceWeek) {
    const people = (saved.request as Data)?.people;
    const declared = Array.isArray(people) && people.some(p => p?.exclusions?.kind === "mapped" && Array.isArray(p.exclusions.allergenIds) && p.exclusions.allergenIds.length);
    if (!saved.allergyBasisSha256 && !declared) return;
    const current = deps.planner.evaluateJoined(saved.assignments, saved.request);
    if (current.outcome !== "success" || !current.allergyBasisSha256 || current.allergyBasisSha256 !== saved.allergyBasisSha256) refuse("saved_allergy_basis_changed", true);
  }
  const unknown = new Set<string>();
  const repository = Object.freeze({
    async read(scope: LocalReferenceScope): Promise<{ outcome: "read"; state: ReferenceEnvelope; storedReferenceOnly: true } | ErrorOutcome | HeldOutcome> {
      try { const bound = active(scope), state = await deps.transactions.transaction(async tx => envelope(await tx.readState(bound.key))); active(scope); return freeze({ outcome: "read", state, storedReferenceOnly: true }); }
      catch (failure) { return failure instanceof Refusal ? error(failure) : { outcome: "error", code: "reference_state_unavailable" }; }
    },
    async getOperationStatus(scope: LocalReferenceScope, idValue: unknown): Promise<{ outcome: "committed"; receipt: Receipt } | { outcome: "not_found"; operationId: string } | ErrorOutcome | HeldOutcome> {
      try {
        const bound = active(scope), id = uuid(idValue), stored = await deps.transactions.transaction(async tx => operation(await tx.readOperation(bound.key, id)));
        if (stored && stored.operationId !== id) refuse("stored_receipt_invalid");
        active(scope); unknown.delete(bound.key + id);
        return stored ? freeze({ outcome: "committed", receipt: stored.receipt }) : { outcome: "not_found", operationId: id };
      } catch (failure) { return failure instanceof Refusal ? error(failure) : { outcome: "error", code: "operation_status_unavailable" }; }
    },
    async applyPlanCommand(scope: LocalReferenceScope, value: unknown): Promise<MutationOutcome> {
      let bound: ScopeInfo, input: Data, id: string, expected: number, weekId: string;
      try {
        bound = active(scope); input = copy(value) as Data;
        if (!input || typeof input !== "object") refuse("invalid_state_command");
        const noPayload = input.kind === "cancel-week-draft" || input.kind === "confirm-new-week";
        const payloadFields = input.kind === "confirm-replacement" ? ["intent", "expectedPreviewSha256", "expectedRequestSha256", "expectedAssignmentsSha256"] : input.kind === "set-shopping-check" ? ["itemKey", "fingerprint", "checked"] : noPayload ? [] : ["request", "assignments"];
        const reviewingPantry = input.kind === "create-week-draft" && newWeekPolicy !== undefined;
        if (reviewingPantry && !Object.hasOwn(input, "pantryConfirmation")) refuse("new_week_pantry_reconfirmation_required", true);
        const basisFields = input.kind === "confirm-replacement" ? (Object.hasOwn(input, "expectedPantryBasisSha256") ? ["expectedPantryBasisSha256"] : []) : !noPayload && input.kind !== "set-shopping-check" && Object.hasOwn(input, "pantryBasis") ? ["pantryBasis"] : [];
        record(input, ["operationId", "kind", "expectedRevision", "weekId", ...(version === 2 ? ["expectedSourcePolicyBasisSha256", ...(Object.hasOwn(input, "sessionIntentSha256") ? ["sessionIntentSha256"] : [])] : []), ...payloadFields, ...basisFields, ...(reviewingPantry ? ["pantryConfirmation"] : [])]);
        if (reviewingPantry) {
          const confirmation = record(input.pantryConfirmation, ["kind", "stockSha256", ...(Object.hasOwn(input, "pantryBasis") ? ["basisSha256"] : [])]);
          if (confirmation.kind !== "reconfirmed") refuse("new_week_pantry_reconfirmation_required", true);
          if (confirmation.stockSha256 !== hash(copy((input.request as Data)?.pantry))) refuse("pantry_confirmation_mismatch");
          if (Object.hasOwn(input, "pantryBasis") && confirmation.basisSha256 !== (input.pantryBasis as ReferencePantryBasis)?.basisSha256) refuse("pantry_confirmation_mismatch");
        }
        if (!["install-current", "save-current", "create-week-draft", "cancel-week-draft", "confirm-new-week", "confirm-replacement", "set-shopping-check"].includes(input.kind as string)) refuse("unsupported_state_command");
        id = uuid(input.operationId); expected = revision(input.expectedRevision); weekId = uuid(input.weekId);
        if (unknown.has(bound.key + id)) return { outcome: "held", code: "operation_status_required" };
      } catch (failure) { return failure instanceof Refusal ? error(failure) : { outcome: "error", code: "invalid_state_command" }; }
      try {
        if (version === 2 && Object.hasOwn(input, "sessionIntentSha256") && (typeof input.sessionIntentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.sessionIntentSha256))) refuse("invalid_state_command");
        const intentSha256 = version === 2 && Object.hasOwn(input, "sessionIntentSha256") ? input.sessionIntentSha256 as string : hash(input);
        const result = await deps.transactions.transaction(async tx => {
          active(scope);
          const prior = operation(await tx.readOperation(bound.key, id));
          if (prior) { if (prior.operationId !== id) refuse("stored_receipt_invalid"); if (prior.intentSha256 !== intentSha256) refuse("idempotency_conflict"); return prior.receipt; }
          if (version === 2 && input.expectedSourcePolicyBasisSha256 !== sourcePolicyBasis!.basisSha256) return { outcome: "error" as const, code: "stale_source_policy_basis", saved: false as const };
          const state = envelope(await tx.readState(bound.key));
          // Fresh save/draft commands fully re-evaluate under the current
          // expected basis. Preserve held old state until explicit replacement
          // or cancellation. Only edits reusing old plan/draft truth must hold.
          if (input.kind === "set-shopping-check" || input.kind === "confirm-replacement") requireCurrentBasis(state.current);
          if (input.kind === "confirm-new-week") requireCurrentBasis(state.draft);
          if (state.revision !== expected) refuse("revision_conflict");
          let next: ReferenceEnvelope;
          if (input.kind === "confirm-new-week") {
            if (state.draft?.weekId !== weekId) refuse("week_draft_missing");
            if (!newWeekPolicy) return { outcome: "held" as const, code: "new_week_retention_policy_required" };
            if (state.draft.newWeekPolicy?.version !== newWeekPolicy) refuse("new_week_pantry_reconfirmation_required", true);
            if (!state.draft.newWeekPolicy.currentSettingsSha256) refuse("new_week_settings_reconfirmation_required", true);
            if (!state.current || settingsDigest(state.current.request) !== state.draft.newWeekPolicy.currentSettingsSha256) refuse("new_week_current_settings_changed", true);
            currentPantry(state.draft);
            const evaluated = (version === 2 ? deps.newWeekRequestPolicy?.(state.draft.request) : null) ?? deps.planner.evaluateJoined(state.draft.assignments, state.draft.request);
            if (evaluated.outcome !== "success") {
              const rejected: RejectedReceipt = { outcome: "not_applied", operationId: id, result: evaluated }, saved = { operationId: id, intentSha256, receipt: rejected };
              copy(saved); active(scope); await tx.commit(bound.key, state, saved); return rejected;
            }
            const candidate = saveWeek(weekId, { request: state.draft.request, ...(state.draft.pantryBasis ? { pantryBasis: state.draft.pantryBasis } : {}) }, evaluated, []);
            if (candidate.sourceSha256 !== state.draft.sourceSha256 || candidate.requestSha256 !== state.draft.requestSha256 || candidate.assignmentsSha256 !== state.draft.assignmentsSha256 || candidate.allergyBasisSha256 !== state.draft.allergyBasisSha256 || hash(copy(candidate.quote)) !== hash(copy(state.draft.quote))) refuse("stale_week_draft");
            next = { revision: state.revision + 1, current: candidate, draft: null };
          } else if (input.kind === "cancel-week-draft") {
            if (state.draft?.weekId !== weekId) refuse("week_draft_missing");
            next = { revision: state.revision + 1, current: state.current, draft: null };
          } else if (input.kind === "set-shopping-check") {
            if (state.current?.weekId !== weekId) refuse("current_week_subject_mismatch");
            currentPantry(state.current);
            currentAllergies(state.current);
            const changed = setShoppingCheck(state.current.quote, currentChecks(state.current), { itemKey: input.itemKey, fingerprint: input.fingerprint, checked: input.checked });
            if (changed.outcome !== "updated") refuse(changed.code);
            const { contentSha256: previousDigest, ...previous } = state.current; void previousDigest;
            const body = { ...previous, shoppingChecks: { status: "ready" as const, rows: changed.rows } };
            const current = { ...body, contentSha256: contentDigest(body, version) };
            next = { revision: state.revision + 1, current, draft: state.draft };
          } else if (input.kind === "confirm-replacement") {
            if (state.current?.weekId !== weekId) refuse("current_week_subject_mismatch");
            currentPantry(state.current);
            currentAllergies(state.current);
            if (state.current.pantryBasis && input.expectedPantryBasisSha256 !== state.current.pantryBasis.basisSha256) refuse("stale_pantry_basis");
            if (!state.current.pantryBasis && Object.hasOwn(input, "expectedPantryBasisSha256")) refuse("stale_pantry_basis");
            const confirmed = deps.planner.confirmReplacement(state.current.assignments, state.current.request, { intent: input.intent, expectedPreviewSha256: input.expectedPreviewSha256, expectedRequestSha256: input.expectedRequestSha256, expectedAssignmentsSha256: input.expectedAssignmentsSha256 });
            if (confirmed.outcome !== "proposal") {
              const rejected: RejectedReceipt = { outcome: "not_applied", operationId: id, result: confirmed }, saved = { operationId: id, intentSha256, receipt: rejected };
              copy(saved); active(scope); await tx.commit(bound.key, state, saved); return rejected;
            }
            let checks = currentChecks(state.current);
            if (version === 2) {
              // Same live scope/transaction, exact week and revision were checked
              // above, after original-receipt lookup and before any new commit.
              // A confirmed allocation change cannot silently alter a purchase.
              const evaluated = confirmed.evaluation as unknown as ReferenceEvaluationSuccessV2;
              if (state.current.sourceSha256 !== evaluated.sourceSha256 || state.current.requestSha256 !== evaluated.requestSha256 ||
                  (state.current as unknown as ReferenceWeekV2).sourcePolicyBasis.basisSha256 !== evaluated.sourcePolicyBasis.basisSha256) refuse("replacement_purchase_custody_changed", true);
              const carried = rebindConfirmedPurchaseChecks(state.current.quote, confirmed.evaluation.quote, checks);
              if (carried.outcome !== "rebound") refuse(carried.code, carried.outcome === "held");
              checks = carried.rows;
            }
            const current = saveWeek(weekId, { request: state.current.request, ...(state.current.pantryBasis ? { pantryBasis: state.current.pantryBasis } : {}) }, confirmed.evaluation, checks);
            next = { revision: state.revision + 1, current, draft: state.draft };
          } else {
            currentPantry(input as { request: unknown; pantryBasis?: unknown });
            const evaluated = (version === 2 ? deps.newWeekRequestPolicy?.(input.request) : null) ?? deps.planner.evaluateJoined(input.assignments, input.request);
            if (evaluated.outcome !== "success") {
              const rejected: RejectedReceipt = { outcome: "not_applied", operationId: id, result: evaluated }, saved = { operationId: id, intentSha256, receipt: rejected };
              copy(saved); active(scope); await tx.commit(bound.key, state, saved); return rejected;
            }
            if (input.kind === "save-current" && state.current?.weekId !== weekId) refuse("current_week_subject_mismatch");
            const previousChecks = input.kind === "save-current" ? currentChecks(state.current!) : input.kind === "create-week-draft" && !newWeekPolicy ? null : [];
            let candidate = saveWeek(weekId, input, evaluated, previousChecks);
            if (input.kind === "create-week-draft" && newWeekPolicy) {
              if (!state.current) refuse("current_week_required");
              const { contentSha256: priorHash, ...prior } = candidate; void priorHash;
              const body = { ...prior, newWeekPolicy: { version: newWeekPolicy, pantrySha256: hash(copy((input.request as Data).pantry)), currentSettingsSha256: settingsDigest(state.current.request), ...(candidate.pantryBasis ? { pantryBasisSha256: candidate.pantryBasis.basisSha256 } : {}) } };
              candidate = { ...body, contentSha256: contentDigest(body, version) };
            }
            if (input.kind === "install-current") {
              if (state.current || state.draft) refuse("current_week_already_exists");
              next = { revision: state.revision + 1, current: candidate, draft: null };
            } else if (input.kind === "save-current") {
              if (state.current?.weekId !== weekId) refuse("current_week_subject_mismatch");
              if (JSON.stringify(dates(state.current)) !== JSON.stringify(dates(candidate))) refuse("current_week_dates_changed");
              next = { revision: state.revision + 1, current: candidate, draft: state.draft };
            } else {
              if (!state.current) refuse("current_week_required");
              if (state.draft) refuse("week_draft_already_exists");
              if (state.current.weekId === weekId || dates(candidate).some(date => dates(state.current!).includes(date))) refuse("new_week_not_distinct");
              next = { revision: state.revision + 1, current: state.current, draft: candidate };
            }
          }
          // Keep the original receipt lookup ahead of clock policy. Old known
          // receipts and historical reads do not become new priced writes.
          const pricedRequest = input.kind === "create-week-draft" ? next.draft?.request : ["install-current", "save-current", "confirm-new-week"].includes(input.kind as string) ? next.current?.request : undefined;
          const clockFailure = version === 2 && pricedRequest !== undefined ? deps.newWeekRequestPolicy?.(pricedRequest) : null;
          if (clockFailure) {
            const rejected: RejectedReceipt = { outcome: "not_applied", operationId: id, result: clockFailure }, saved = { operationId: id, intentSha256, receipt: rejected };
            copy(saved); active(scope); await tx.commit(bound.key, state, saved); return rejected;
          }
          const ack = receipt({ outcome: "acknowledged", operationId: id, state: next, ...(version === 2 ? { committedSourcePolicyBasisSha256: sourcePolicyBasis!.basisSha256 } : {}) }) as AcceptedReceipt, saved = { operationId: id, intentSha256, receipt: ack };
          // Bound before commit, never discover oversized acknowledgements only
          // after a write. This private8MiBresource guard is not a public API
          // policy; the old owner codec/PINS/schema remain unchanged.
          copy(saved); active(scope); await tx.commit(bound.key, ack.state, saved); return ack;
        });
        active(scope); return freeze(result);
      } catch (failure) {
        if (failure instanceof Refusal) return error(failure);
        unknown.add(bound.key + id); return { outcome: "unknown", operationId: id, statusRequired: true };
      }
    },
  });
  if (version === 2) originalLookupsV2.set(repository, async (scope, idValue, digestValue) => {
    try {
      const bound = active(scope), id = uuid(idValue), digest = text(digestValue);
      if (!/^[a-f0-9]{64}$/.test(digest)) refuse("invalid_state_command");
      if (unknown.has(bound.key + id)) return { outcome: "held", code: "operation_status_required" };
      const prior = await deps.transactions.transaction(async tx => operation(await tx.readOperation(bound.key, id)));
      active(scope);
      if (!prior) return null;
      if (prior.operationId !== id) refuse("stored_receipt_invalid");
      if (prior.intentSha256 !== digest) refuse("idempotency_conflict");
      return freeze(prior.receipt);
    } catch (failure) { return failure instanceof Refusal ? error(failure) : { outcome: "error", code: "operation_status_unavailable" }; }
  });
  return repository;
}
