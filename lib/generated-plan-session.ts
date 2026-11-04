import {retainV3PurchaseCustody} from "./generated-regional-quote.ts";
import {createJoinedReferencePlannerV4,createJoinedReferencePlannerV3,type JoinedReferenceBindingV3} from "./generated-joined-plan.ts";
import {createReferencePlanRepositoryV3,type ReferenceStatePortV3} from "./generated-plan-state.ts";
import {presentGroceriesV3,presentRecipeV3} from "./generated-plan-presenter.ts";
import { webRuntimeHttp, type RuntimeHttp, type RuntimeRequest, type RuntimeResponse } from "./generated-runtime-http.ts";
import { utf8ByteLength } from "./generated-runtime-bytes.ts";
import { createJoinedReferencePlanner, createJoinedReferencePlannerV2, type JoinedReferenceBindingV2, type ReferenceEvaluationSuccessV2 } from "./generated-joined-plan.ts";
import { createBoundReferenceOperationRuntimeHandler, referenceOperationDigest } from "./generated-plan-operations.ts";
import { JOINED_PLAN_DRAFT_CONTRACT } from "../packages/solver/src/generated-plan-contract.ts";
import { createReferencePlanRepository, NEW_WEEK_RECONFIRM_POLICY, type LocalReferenceScope, type ReferenceStatePort, type ReferenceEnvelope, type ReferenceWeek, createReferencePlanRepositoryV2, type ReferenceWeekV2, type ReferenceStatePortV2, resolveOriginalReferenceOperationV2 } from "./generated-plan-state.ts";
import { readReferenceJson, ReferenceBodyError } from "./generated-plan-json.ts";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { presentGroceries as legacyGroceries, presentRecipe as legacyRecipe, presentGroceriesV2, presentRecipeV2, nonShoppingUsageV2 } from "./generated-plan-presenter.ts";
import type { ReviewedImageIndex } from "./generated-plan-images.ts";
import { UUID } from "./generated-runtime-identity.ts";
import { preparePantryBasis, revalidatePantryBasis } from "./generated-plan-pantry-basis.ts";
import { readReviewedReferenceDataV1, referenceConfigurationDigest, REVIEWED_REFERENCE_DATA, type ReviewedReferenceDataV1 } from "./generated-reviewed-reference-data.ts";

// A versioned producer proposal, not a public route, accepted native contract or
// account/access provider. Only the trusted host can resolve an opaque scope.
export const REFERENCE_SESSION_CONTRACT = "wd-joined-session-proposal-v1";
export const REFERENCE_SESSION_CONTRACT_V2 = "wd-joined-session-proposal-v2";
type Data = Record<string, unknown>;
type Context<Q extends RuntimeRequest = Request> = { readonly request: Q; readonly operation: string; readonly operationId: string; readonly intentSha256: string };
type Options<Q extends RuntimeRequest = Request> = { readonly labels: unknown; readonly transactions: ReferenceStatePort; readonly resolveScope?: (context: Context<Q>) => LocalReferenceScope | "deny" | null | Promise<LocalReferenceScope | "deny" | null>; readonly newWeekPolicy?: typeof NEW_WEEK_RECONFIRM_POLICY; readonly images?: ReviewedImageIndex; readonly newWeekRequestPolicy?: import("./generated-source-clock.ts").NewWeekRequestPolicy };
const PURE = ["preparePantry", "evaluateJoined", "planJoined", "findReplacements", "previewReplacement", "confirmReplacement"];
const STATE = ["readCurrent", "operationStatus", "installCurrent", "saveCurrent", "createWeekDraft", "cancelWeekDraft", "confirmNewWeek", "shoppingCheck", "saveReplacement"];
const HELD = ["signIn", "trial", "restore", "storePrices"];
class InputError extends Error {}
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || required.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => ![...required, ...optional].includes(k))) throw new InputError("Invalid session input");
  return value as Data;
}
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

type SessionBindingV1 = { readonly outcome: "error"; readonly code: string } | { readonly outcome: "ready"; readonly source: { readonly sha256: string; readonly recordCount: number }; readonly handle: (request: Request) => Promise<Response> };
type SessionBindingV2 = Exclude<ReturnType<typeof createJoinedReferencePlannerV2>, { outcome: "ready" }> | Extract<SessionBindingV1, { outcome: "ready" }> & { readonly sourcePolicyBasis: import("./generated-source-policy-basis-v2.ts").SourcePolicyBasisV2 };
export function createReferenceSessionHandler(source: unknown, configuration: unknown, options: Options): SessionBindingV1 { return createSession(source, configuration, options, 1, webRuntimeHttp()) as SessionBindingV1; }
export function createReferenceSessionHandlerV2(source: unknown, configuration: unknown, options: Omit<Options, "transactions"> & { readonly transactions: ReferenceStatePortV2 }): SessionBindingV2 { return createSession(source, configuration, options as unknown as Options, 2, webRuntimeHttp()) as SessionBindingV2; }
export function createReferenceSessionPortV2(source: unknown, configuration: unknown, options: Omit<Options<RuntimeRequest>, "transactions"> & { readonly transactions: ReferenceStatePortV2 }, runtime: RuntimeHttp<RuntimeRequest, RuntimeResponse>) { return createSession(source, configuration, options as unknown as Options<RuntimeRequest>, 2, runtime); }
function createSession<Q extends RuntimeRequest, S extends RuntimeResponse>(source: unknown, configuration: unknown, options: Options<Q>, version: 1 | 2 | 3, runtime: RuntimeHttp<Q, S>) {
  const binding = (version === 1 ? createJoinedReferencePlanner : createJoinedReferencePlannerV2)(source, configuration);
  return createSessionFromBinding(binding, options, version, runtime);
}
// Capture one genuine validated planner, then bind separate owner/repository
// instances. No request-supplied binding or mutable configuration cache key.
export function createReferenceSessionFactoryV2(source: unknown, configuration: unknown, trusted?: { readonly reviewedReferenceData?: ReviewedReferenceDataV1; readonly currentGuidePolicy?: import("./generated-joined-plan.ts").CurrentGuidePolicy }) {
  const binding = createJoinedReferencePlannerV2(source, configuration, trusted);
  if (binding.outcome !== "ready") return binding;
  let reviewed: ReviewedReferenceDataV1 | undefined;
  if (trusted?.reviewedReferenceData !== undefined) {
    const read = readReviewedReferenceDataV1(source, trusted.reviewedReferenceData);
    if (read.outcome !== "ready" || read.packet.configurationSha256 !== referenceConfigurationDigest(configuration) || read.packet.sourcePolicyBasis.basisSha256 !== binding.sourcePolicyBasis.basisSha256) return { outcome: "error" as const, code: "invalid_reviewed_reference_data" };
    reviewed = read.packet;
  }
  return Object.freeze({ outcome: "ready" as const, source: binding.source, sourcePolicyBasis: binding.sourcePolicyBasis,
    bind: (options: Omit<Options, "transactions"> & { readonly transactions: ReferenceStatePortV2 }) => createSessionFromBinding(binding, options as unknown as Options, 2, webRuntimeHttp(), reviewed) as SessionBindingV2 });
}
export function createReferenceSessionFactoryV3(source:unknown,configuration:unknown,trusted?:{readonly reviewedReferenceData?:ReviewedReferenceDataV1;readonly currentGuidePolicy?:import("./generated-joined-plan.ts").CurrentGuidePolicy}){
 const binding=createJoinedReferencePlannerV3(source,configuration,trusted);if(binding.outcome!=="ready")return binding;
 let reviewed:ReviewedReferenceDataV1|undefined;
 if(trusted?.reviewedReferenceData!==undefined){const read=readReviewedReferenceDataV1(source,trusted.reviewedReferenceData);if(read.outcome!=="ready"||read.packet.configurationSha256!==referenceConfigurationDigest(configuration)||read.packet.sourcePolicyBasis.basisSha256!==binding.sourcePolicyBasis.basisSha256)return {outcome:"error" as const,code:"invalid_reviewed_reference_data"};reviewed=read.packet;}
 return Object.freeze({outcome:"ready" as const,source:binding.source,sourcePolicyBasis:binding.sourcePolicyBasis,bind:(options:Omit<Options,"transactions">&{readonly transactions:ReferenceStatePortV3})=>createSessionFromBinding(binding,options as unknown as Options,3,webRuntimeHttp(),reviewed) as SessionBindingV2});
}
export function createReferenceSessionFactoryV4(source:unknown,configuration:unknown,trusted?:{readonly reviewedReferenceData?:ReviewedReferenceDataV1;readonly currentGuidePolicy?:import("./generated-joined-plan.ts").CurrentGuidePolicy}){
 const binding=createJoinedReferencePlannerV4(source,configuration,trusted);if(binding.outcome!=="ready")return binding;
 let reviewed:ReviewedReferenceDataV1|undefined;
 if(trusted?.reviewedReferenceData!==undefined){const read=readReviewedReferenceDataV1(source,trusted.reviewedReferenceData);if(read.outcome!=="ready"||read.packet.configurationSha256!==referenceConfigurationDigest(configuration)||read.packet.sourcePolicyBasis.basisSha256!==binding.sourcePolicyBasis.basisSha256)return {outcome:"error" as const,code:"invalid_reviewed_reference_data"};reviewed=read.packet;}
 return Object.freeze({outcome:"ready" as const,source:binding.source,sourcePolicyBasis:binding.sourcePolicyBasis,bind:(options:Omit<Options,"transactions">&{readonly transactions:ReferenceStatePortV3})=>createSessionFromBinding(binding,options as unknown as Options,3,webRuntimeHttp(),reviewed) as SessionBindingV2});
}
function createSessionFromBinding<Q extends RuntimeRequest, S extends RuntimeResponse>(binding: ReturnType<typeof createJoinedReferencePlanner> | JoinedReferenceBindingV2 | JoinedReferenceBindingV3, options: Options<Q>, version: 1 | 2 | 3, runtime: RuntimeHttp<Q, S>, reviewed?: ReviewedReferenceDataV1) {
  if (binding.outcome !== "ready") return binding;
  const bound = binding as Extract<ReturnType<typeof createJoinedReferencePlanner>, { outcome: "ready" }>;
  const basis = version >= 2 ? (binding as Extract<JoinedReferenceBindingV2, { outcome: "ready" }>).sourcePolicyBasis : null;
  const contract = version === 1 ? REFERENCE_SESSION_CONTRACT : REFERENCE_SESSION_CONTRACT_V2;
  const presentGroceries = version===3?presentGroceriesV3 as unknown as typeof legacyGroceries:version === 1 ? legacyGroceries : presentGroceriesV2 as unknown as typeof legacyGroceries;
  const presentRecipe = version===3?presentRecipeV3 as unknown as typeof legacyRecipe:version === 1 ? legacyRecipe : presentRecipeV2 as unknown as typeof legacyRecipe;
  let labels: unknown, repository: ReturnType<typeof createReferencePlanRepository>;
  try {
    labels = freeze(copyReferenceData(options.labels));
    if (options.resolveScope !== undefined && typeof options.resolveScope !== "function") throw new InputError("Invalid scope binding");
    repository = version===3?createReferencePlanRepositoryV3({planner:(binding as Extract<JoinedReferenceBindingV3,{outcome:"ready"}>).planner,sourcePolicyBasis:basis!,transactions:options.transactions as unknown as ReferenceStatePortV3,newWeekPolicy:options.newWeekPolicy,newWeekRequestPolicy:options.newWeekRequestPolicy}) as unknown as ReturnType<typeof createReferencePlanRepository>:version === 1 ? createReferencePlanRepository({ planner: bound.planner, transactions: options.transactions, newWeekPolicy: options.newWeekPolicy }) : createReferencePlanRepositoryV2({ planner: (binding as Extract<JoinedReferenceBindingV2, { outcome: "ready" }>).planner, sourcePolicyBasis: basis!, transactions: options.transactions as unknown as ReferenceStatePortV2, newWeekPolicy: options.newWeekPolicy, newWeekRequestPolicy: options.newWeekRequestPolicy }) as unknown as ReturnType<typeof createReferencePlanRepository>;
  } catch { return { outcome: "error", code: "invalid_session_configuration" } as const; }
  const resolveScope = options.resolveScope, images = options.images, newWeekPolicy = options.newWeekPolicy;
  // Internal provenance stays on durable V2 receipts. Keep it out of normal
  // strict acknowledgement DTOs, but retain it for post-serialization capacity.
  const committedBases = new WeakMap<object, string>();
  function savedWeek(saved: ReferenceWeek | null) {
    if (!saved) return null;
    const identity = { weekId: saved.weekId, sourceSha256: saved.sourceSha256, requestSha256: saved.requestSha256, assignmentsSha256: saved.assignmentsSha256, contentSha256: saved.contentSha256, pantryBasisSha256: saved.pantryBasis?.basisSha256 ?? null, ...(version >= 2 ? { sourcePolicyBasisSha256: (saved as unknown as ReferenceWeekV2).sourcePolicyBasis.basisSha256 } : {}) };
    if (version >= 2 && (saved as unknown as ReferenceWeekV2).sourcePolicyBasis.basisSha256 !== basis!.basisSha256) return { ...identity, view: { outcome: "held", code: "saved_source_policy_basis_changed" } };
    if (saved.pantryBasis) {
      const checked = revalidatePantryBasis(bound.planner.preparePantry, saved.pantryBasis, (saved.request as Data)?.pantry);
      if (checked.outcome !== "ready") return { ...identity, view: { outcome: checked.outcome, code: checked.code } };
    }
    let evaluated = bound.planner.evaluateJoined(saved.assignments, saved.request);
    if(version===3&&evaluated.outcome==="success"){
     const next=evaluated as unknown as import("./generated-joined-plan.ts").ReferenceEvaluationSuccessV3;
     if(saved.sourceSha256!==next.sourceSha256||(saved as unknown as ReferenceWeekV2).sourcePolicyBasis.basisSha256!==next.sourcePolicyBasis.basisSha256)return {...identity,view:{outcome:"held",code:"saved_source_policy_basis_changed"}};
     try{evaluated={...next,quote:retainV3PurchaseCustody(saved.quote as unknown as import("./generated-regional-quote.ts").RegionalQuoteSuccessV3,next.quote)} as unknown as typeof evaluated;}catch{return {...identity,view:{outcome:"held",code:"saved_purchase_custody_changed"}};}
    }
    let view: unknown = evaluated;
    if (evaluated.outcome === "success") {
      if (evaluated.sourceSha256 !== saved.sourceSha256 || evaluated.requestSha256 !== saved.requestSha256 || evaluated.assignmentsSha256 !== saved.assignmentsSha256 || evaluated.allergyBasisSha256 !== saved.allergyBasisSha256 || referenceOperationDigest(evaluated.quote) !== referenceOperationDigest(saved.quote) || version >= 2 && referenceOperationDigest((evaluated as unknown as ReferenceEvaluationSuccessV2).utilityPartition) !== referenceOperationDigest((saved as unknown as ReferenceWeekV2).utilityPartition)) return { ...identity, view: { outcome: "held", code: "saved_view_basis_changed" } };
      const meals = evaluated.projection.assignments.map(a => presentRecipe(evaluated, a.personId, a.assignmentId, images));
      const groceries = presentGroceries(evaluated, labels, saved.shoppingChecks.status === "ready" ? saved.shoppingChecks.rows : undefined);
      view = groceries.outcome === "groceries" && meals.every(m => m.outcome === "recipe") ? { outcome: "saved-week", meals, personDays: evaluated.projection.personDays, groceries, sourceSha256: evaluated.sourceSha256, ...(version >= 2 ? { nonShoppingUsage: nonShoppingUsageV2(evaluated as unknown as ReferenceEvaluationSuccessV2) } : {}), proteinCoverage: evaluated.fullDayCoverage ? "planned-breakfast-lunch-dinner" : "selected-meals-only" } : { outcome: "held", code: "saved_view_unavailable" };
    }
    return { ...identity, view };
  }
  function stateView(state: ReferenceEnvelope) { return { revision: state.revision, current: savedWeek(state.current), draft: savedWeek(state.draft) }; }
  function safeResult(value: unknown): unknown {
    const result = value as Data;
    if (result.outcome === "read") return { outcome: "read", state: stateView(result.state as ReferenceEnvelope), storedReferenceOnly: true };
    if (result.outcome === "acknowledged") {
      const projected = { outcome: "acknowledged", operationId: result.operationId, saved: true, state: stateView(result.state as ReferenceEnvelope) };
      if (version >= 2) {
        if (typeof result.committedSourcePolicyBasisSha256 !== "string" || !/^[a-f0-9]{64}$/.test(result.committedSourcePolicyBasisSha256)) throw new InputError("Invalid committed policy basis");
        committedBases.set(projected, result.committedSourcePolicyBasisSha256);
      }
      return projected;
    }
    if (result.outcome === "committed") return { outcome: "committed", receipt: safeResult(result.receipt) };
    return result;
  }
  function status(result: unknown): number {
    const row = result as Data;
    if (row.outcome === "unknown") return 202;
    if (row.outcome === "held") return 422;
    if (row.outcome === "error") return ["revision_conflict", "idempotency_conflict", "stale_week_draft", "stale_pantry_basis", "stale_source_policy_basis"].includes(String(row.code)) ? 409 : 400;
    return 200;
  }
  async function handle(request: Q): Promise<S> {
    let operation: string | null = null, operationId: string | null = null, intentSha256: string | null = null;
    const respond = (result: unknown, code = status(result)) => {
      const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
      const encode = (value: unknown) => JSON.stringify({ contract, apiAccepted: false, productionReady: false, mode: "private-conditional-reference-only", operation, operationId, intentSha256, ...(version >= 2 ? { sourcePolicyBasisSha256: basis!.basisSha256 } : {}), result: value });
      const body = encode(result);
      if (utf8ByteLength(body) > 16 * 1024 * 1024) {
        const row = result as Data, receipt = (row.outcome === "committed" ? row.receipt : row) as Data;
        const committed = receipt.outcome === "acknowledged", rejected = receipt.outcome === "not_applied";
        const mutation = operation !== null && STATE.includes(operation) && !["readCurrent", "operationStatus"].includes(operation);
        // Serialization is after the transaction. A smaller response must not
        // erase a known commit, claim rollback or cause an endless status loop.
        const uncertain = mutation && !committed && !rejected;
        const capacity = { outcome: "held", code: "response_capacity_review", ...(!uncertain ? { saved: committed } : {}), writeOutcome: committed ? "committed" : rejected ? "not-applied" : uncertain ? "unknown" : "not-requested", ...(committed ? { targetOperationId: receipt.operationId, revision: (receipt.state as Data).revision, ...(version >= 2 ? { committedSourcePolicyBasisSha256: committedBases.get(receipt)! } : {}) } : uncertain ? { targetOperationId: operationId } : {}), reconcileOperationStatus: committed ? operation !== "operationStatus" : uncertain };
        return runtime.response(encode(capacity), { status: 422, headers });
      }
      return runtime.response(body, { status: code, headers });
    };
    if (request.method !== "POST") return respond({ outcome: "error", code: "post_required" }, 405);
    let envelope: Data, payload: Data;
    try {
      envelope = record(await readReferenceJson(request), ["contract", "operation", "operationId", "sourceSha256", "payload", "intentSha256", ...(version >= 2 ? ["expectedSourcePolicyBasisSha256"] : [])]);
      if (typeof envelope.operation !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,59}$/.test(envelope.operation) || typeof envelope.operationId !== "string" || !UUID.test(envelope.operationId) || typeof envelope.intentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(envelope.intentSha256)) throw new InputError("Invalid envelope");
      operation = envelope.operation; operationId = envelope.operationId; intentSha256 = envelope.intentSha256;
      if (version >= 2 && envelope.expectedSourcePolicyBasisSha256 !== null && (typeof envelope.expectedSourcePolicyBasisSha256 !== "string" || !/^[a-f0-9]{64}$/.test(envelope.expectedSourcePolicyBasisSha256))) throw new InputError("Invalid expected source policy");
      payload = record(envelope.payload, [], Object.keys(envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {}));
      if (envelope.contract !== contract) return respond({ outcome: "error", code: "contract_mismatch" }, 409);
      if (envelope.sourceSha256 !== bound.source.sha256) return respond({ outcome: "error", code: "source_mismatch" }, 409);
      const { intentSha256: ignored, ...intent } = envelope; void ignored;
      if (referenceOperationDigest(intent) !== intentSha256) return respond({ outcome: "error", code: "intent_digest_mismatch" }, 409);
      freeze(payload);
    } catch (error) {
      const code = error instanceof ReferenceBodyError ? error.code : "invalid_operation_envelope";
      return respond({ outcome: "error", code }, code === "request_aborted" ? 499 : code === "body_capacity_exceeded" ? 413 : 400);
    }
    if (!resolveScope) return respond({ outcome: "held", code: "scope_binding_required" }, 503);
    let scope: LocalReferenceScope;
    try {
      const resolved = await resolveScope(Object.freeze({ request, operation, operationId, intentSha256 }));
      if (!resolved || resolved === "deny") return respond({ outcome: resolved === "deny" ? "error" : "held", code: resolved === "deny" ? "access_denied" : "scope_unavailable" }, resolved === "deny" ? 403 : 503);
      scope = resolved;
    } catch { return respond({ outcome: "held", code: "scope_unavailable" }, 503); }
    if (request.signal.aborted) return respond({ outcome: "error", code: "request_aborted" }, 499);
    try {
      if (operation === "capabilities") {
        const opted = version >= 2 && Object.hasOwn(payload, "reviewedReferenceData");
        record(payload, opted ? ["reviewedReferenceData"] : []);
        if (opted && payload.reviewedReferenceData !== REVIEWED_REFERENCE_DATA) throw new InputError("Unsupported reviewed data version");
        if (version >= 2 && envelope.expectedSourcePolicyBasisSha256 !== null && envelope.expectedSourcePolicyBasisSha256 !== basis!.basisSha256) return respond({ outcome: "error", code: "stale_source_policy_basis", saved: false }, 409);
        const checked = await repository.read(scope); if (checked.outcome !== "read") return respond(checked);
        if (opted && !reviewed) return respond({ outcome: "held", code: "reviewed_reference_data_unavailable" });
        return respond({ outcome: "capabilities", source: bound.source, supported: ["capabilities", ...PURE, ...STATE], held: HELD, newWeekPolicy: newWeekPolicy ?? null, pantryPersistence: "original-observations-and-current-trusted-basis-required", acceptedByNative: false, hostedAuthorizationVerified: false, commercialAccessVerified: false, ...(version >= 2 ? { sourcePolicies: { session: contract, referencePrices: basis!.referencePricePolicy, tapCookingWater: basis!.utilityPolicy, sourcePolicyBasisSha256: basis!.basisSha256 } } : {}), ...(opted ? { reviewedReferenceData: reviewed } : {}) });
      }
      if (PURE.includes(operation)) {
        const pure = createBoundReferenceOperationRuntimeHandler(bound, { labels, images, newWeekRequestPolicy: options.newWeekRequestPolicy, authorize: async () => (await repository.read(scope)).outcome === "read" ? "allow" : "deny" }, version===1?1:2, runtime);
        if (pure.outcome !== "ready") return respond(pure);
        const intent: Data = { ...envelope, contract: version === 1 ? JOINED_PLAN_DRAFT_CONTRACT : REFERENCE_SESSION_CONTRACT_V2 }; delete intent.intentSha256;
        const inner = runtime.request(request.url, { method: "POST", body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }), headers: { "content-type": "application/json" }, signal: request.signal });
        const response = await pure.handle(inner), body = await response.json();
        const stillActive = await repository.read(scope); if (stillActive.outcome !== "read") return respond(stillActive);
        return respond(body.result, response.status);
      }
      if (HELD.includes(operation)) return respond({ outcome: "held", code: "operation_not_bound" });
      if (!STATE.includes(operation)) return respond({ outcome: "error", code: "unsupported_operation" });
      if (version >= 2 && !["readCurrent", "operationStatus"].includes(operation)) {
        // Resolve an exact original durable intent BEFORE current pantry/source
        // preparation. Drift cannot erase or rewrite an acknowledged operation.
        const original = await resolveOriginalReferenceOperationV2(repository, scope, operationId, intentSha256);
        if (original) return respond(safeResult(original));
      }
      let result: unknown;
      if (operation === "readCurrent") { record(payload, []); result = await repository.read(scope); }
      else if (operation === "operationStatus") { record(payload, ["targetOperationId"]); result = await repository.getOperationStatus(scope, payload.targetOperationId); }
      else {
        const command: Data = { operationId, expectedRevision: payload.expectedRevision, weekId: payload.weekId, ...(version >= 2 ? { expectedSourcePolicyBasisSha256: envelope.expectedSourcePolicyBasisSha256, sessionIntentSha256: intentSha256 } : {}) };
        if (["installCurrent", "saveCurrent", "createWeekDraft"].includes(operation)) {
          record(payload, ["expectedRevision", "weekId", "request", "assignments", "pantryEntries"], ["expectedPantryBasisSha256", ...(operation === "createWeekDraft" ? ["pantryReconfirmed"] : [])]);
          const selected = copyReferenceData(payload.request) as Data;
          if (!selected || !Array.isArray(selected.pantry) || selected.pantry.length) return respond({ outcome: "error", code: "raw_pantry_entries_required" });
          if (!Array.isArray(payload.pantryEntries)) throw new InputError("Invalid pantry");
          const prepared = preparePantryBasis(bound.planner.preparePantry, payload.pantryEntries);
          if (prepared.outcome === "ready") {
            if (Object.hasOwn(payload, "expectedPantryBasisSha256") && payload.expectedPantryBasisSha256 !== prepared.basis.basisSha256) return respond({ outcome: "error", code: "stale_pantry_basis" }, 409);
            selected.pantry = prepared.pantry; command.pantryBasis = prepared.basis;
          } else if (payload.pantryEntries.length || prepared.outcome !== "held" || prepared.code !== "pantry_intake_not_configured") return respond(prepared);
          else if (Object.hasOwn(payload, "expectedPantryBasisSha256")) return respond({ outcome: "error", code: "stale_pantry_basis" }, 409);
          Object.assign(command, { kind: operation === "installCurrent" ? "install-current" : operation === "saveCurrent" ? "save-current" : "create-week-draft", request: selected, assignments: payload.assignments });
          if (operation === "createWeekDraft" && newWeekPolicy) {
            if (payload.pantryReconfirmed !== true) return respond({ outcome: "held", code: "new_week_pantry_reconfirmation_required" });
            command.pantryConfirmation = { kind: "reconfirmed", stockSha256: referenceOperationDigest(canonicalReferenceData(selected.pantry)), ...(prepared.outcome === "ready" ? { basisSha256: prepared.basis.basisSha256 } : {}) };
          }
        } else if (operation === "shoppingCheck") {
          record(payload, ["expectedRevision", "weekId", "itemKey", "fingerprint", "checked"]); Object.assign(command, { kind: "set-shopping-check", itemKey: payload.itemKey, fingerprint: payload.fingerprint, checked: payload.checked });
        } else if (operation === "saveReplacement") {
          record(payload, ["expectedRevision", "weekId", "intent", "expectedPreviewSha256", "expectedRequestSha256", "expectedAssignmentsSha256"], ["expectedPantryBasisSha256"]); Object.assign(command, { ...payload, kind: "confirm-replacement" });
        } else {
          record(payload, ["expectedRevision", "weekId"]); command.kind = operation === "confirmNewWeek" ? "confirm-new-week" : "cancel-week-draft";
        }
        result = await repository.applyPlanCommand(scope, command);
      }
      return respond(safeResult(result));
    } catch (error) { return respond({ outcome: "error", code: error instanceof InputError ? "invalid_operation_payload" : "session_operation_unavailable", reconcileOperationStatus: true }, error instanceof InputError ? 400 : 503); }
  }
  return Object.freeze({ outcome: "ready" as const, source: bound.source, ...(version >= 2 ? { sourcePolicyBasis: basis! } : {}), handle });
}
