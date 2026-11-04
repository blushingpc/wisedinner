import { webRuntimeHttp, type RuntimeHttp, type RuntimeRequest, type RuntimeResponse } from "./generated-runtime-http.ts";
import { utf8ByteLength } from "./generated-runtime-bytes.ts";
import { createJoinedReferencePlanner, type ReferenceEvaluationSuccess, type JoinedReferenceBinding, createJoinedReferencePlannerV2, type JoinedReferenceBindingV2, type ReferenceEvaluationSuccessV2 } from "./generated-joined-plan.ts";
import { JOINED_PLAN_DRAFT_CONTRACT } from "../packages/solver/src/generated-plan-contract.ts";
import { UUID } from "./generated-runtime-identity.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { presentRecipe as legacyRecipe, presentGroceries as legacyGroceries, presentReplacement as legacyReplacement, presentAlternatives as legacyAlternatives, presentRecipeV2, presentGroceriesV2, presentReplacementV2, presentAlternativesV2, nonShoppingUsageV2 } from "./generated-plan-presenter.ts";
import type { ReviewedImageIndex } from "./generated-plan-images.ts";
import { readReferenceJson, ReferenceBodyError } from "./generated-plan-json.ts";
import { REPLACEMENT_PROTEIN_RULE, REPLACEMENT_RULE_V2 } from "./generated-plan-protein-tolerance.ts";
import type { NewWeekRequestPolicy } from "./generated-source-clock.ts";

// Unbound private Request/Response adapter. No Next route, listener, provider,
// storage or auth implementation. JSON is never an authorization grant.
type Data = Record<string, unknown>;
type AuthorizationContext<Q extends RuntimeRequest = Request> = { readonly request: Q; readonly operation: string; readonly operationId: string; readonly intentSha256: string; readonly payload: Readonly<Data> };
type Options<Q extends RuntimeRequest = Request> = { readonly labels: unknown; readonly authorize?: (context: AuthorizationContext<Q>) => "allow" | "deny" | "unavailable" | Promise<"allow" | "deny" | "unavailable">; readonly images?: ReviewedImageIndex; readonly newWeekRequestPolicy?: NewWeekRequestPolicy };
const SUPPORTED = ["capabilities", "preparePantry", "evaluateJoined", "planJoined", "findReplacements", "previewReplacement", "confirmReplacement"] as const;
const HELD = ["saveCurrent", "operationStatus", "createWeekDraft", "confirmNewWeek", "shoppingCheck", "signIn", "restore", "trial", "storePrices"] as const;
const digest = (value: unknown) => hash(canonicalReferenceData(value));
class OperationInputError extends Error {}
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) throw new OperationInputError("Invalid operation"); return value as Data;
}
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function referenceOperationDigest(envelopeWithoutDigest: unknown): string { return digest(envelopeWithoutDigest); }

export function createReferenceOperationHandler(source: unknown, configuration: unknown, options: Options) {
  const binding = createJoinedReferencePlanner(source, configuration); if (binding.outcome !== "ready") return binding;
  return createBoundReferenceOperationHandler(binding, options);
}

// Trusted producer composition only. Reuse the very same immutable planner as
// the state repository; never rebuild it from caller-owned bytes/configuration
// during a request. This is not a customer-supplied binding or another API.
export function createBoundReferenceOperationHandler(bound: Extract<JoinedReferenceBinding, { outcome: "ready" }>, options: Options) { return createOperationHandler(bound, options, 1, webRuntimeHttp()); }
export function createReferenceOperationHandlerV2(source: unknown, configuration: unknown, options: Options) {
  const binding = createJoinedReferencePlannerV2(source, configuration); if (binding.outcome !== "ready") return binding;
  return createBoundReferenceOperationHandlerV2(binding, options);
}
export function createBoundReferenceOperationHandlerV2(bound: Extract<JoinedReferenceBindingV2, { outcome: "ready" }>, options: Options) { return createOperationHandler(bound as unknown as Extract<JoinedReferenceBinding, { outcome: "ready" }>, options, 2, webRuntimeHttp()); }
export function createBoundReferenceOperationRuntimeHandler<Q extends RuntimeRequest, S extends RuntimeResponse>(bound: Extract<JoinedReferenceBinding | JoinedReferenceBindingV2, { outcome: "ready" }>, options: Options<Q>, version: 1 | 2, runtime: RuntimeHttp<Q, S>) { return createOperationHandler(bound as Extract<JoinedReferenceBinding, { outcome: "ready" }>, options, version, runtime); }
function createOperationHandler<Q extends RuntimeRequest, S extends RuntimeResponse>(bound: Extract<JoinedReferenceBinding, { outcome: "ready" }>, options: Options<Q>, version: 1 | 2, runtime: RuntimeHttp<Q, S>) {
  const basis = version === 2 ? (bound as unknown as Extract<JoinedReferenceBindingV2, { outcome: "ready" }>).sourcePolicyBasis : null;
  const presentRecipe = version === 1 ? legacyRecipe : presentRecipeV2 as unknown as typeof legacyRecipe;
  const presentGroceries = version === 1 ? legacyGroceries : presentGroceriesV2 as unknown as typeof legacyGroceries;
  const presentReplacement = version === 1 ? legacyReplacement : presentReplacementV2 as unknown as typeof legacyReplacement;
  const presentAlternatives = version === 1 ? legacyAlternatives : presentAlternativesV2 as unknown as typeof legacyAlternatives;
  const contract = version === 1 ? JOINED_PLAN_DRAFT_CONTRACT : "wd-joined-session-proposal-v2";
  let configured: unknown;
  try { configured = freeze(copyReferenceData(options.labels)); } catch { return { outcome: "error", code: "invalid_operation_configuration" } as const; }
  const authorize = options.authorize, images = options.images;
  if (authorize !== undefined && typeof authorize !== "function") return { outcome: "error", code: "invalid_operation_configuration" } as const;
  function week(evaluation: ReferenceEvaluationSuccess) {
    const groceries = presentGroceries(evaluation, configured); if (groceries.outcome !== "groceries") return groceries;
    const meals = [];
    for (const row of evaluation.projection.assignments) {
      const recipe = presentRecipe(evaluation, row.personId, row.assignmentId, images); if (recipe.outcome !== "recipe") return recipe;
      meals.push({ ...recipe, profileRevision: row.profileRevision, date: row.date, slot: row.slot });
    }
    return { outcome: "week-proposal" as const, catalogSha256: evaluation.sourceSha256, requestSha256: evaluation.requestSha256, assignmentsSha256: evaluation.assignmentsSha256, meals, personDays: evaluation.projection.personDays, groceries, proteinCoverage: evaluation.fullDayCoverage ? "planned-breakfast-lunch-dinner" as const : "selected-meals-only" as const, ...(version === 2 ? { sourcePolicyBasisSha256: basis!.basisSha256, nonShoppingUsage: nonShoppingUsageV2(evaluation as unknown as ReferenceEvaluationSuccessV2) } : {}), saved: false as const };
  }
  async function handle(request: Q): Promise<S> {
    let operation: string | null = null, operationId: string | null = null, intentSha256: string | null = null;
    function respond(result: unknown, status = 200) {
      const encode = (value: unknown) => JSON.stringify({ contract, mode: "private-conditional-reference-only", apiAccepted: false, productionReady: false, operation, operationId, intentSha256, ...(version === 1 ? { replaySemantics: "pure-recompute-no-write" } : { sourcePolicyBasisSha256: basis!.basisSha256 }), result: value });
      const body = encode(result);
      const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
      if (utf8ByteLength(body) > 16 * 1024 * 1024) return runtime.response(encode({ outcome: "held", code: "response_capacity_review", saved: false, ...(version === 2 ? { writeOutcome: "not-requested" } : {}), reconcileOperationStatus: false }), { status: 422, headers });
      return runtime.response(body, { status, headers });
    }
    if (request.method !== "POST") return respond({ outcome: "error", code: "post_required" }, 405);
    let envelope: Data, payload: Data;
    try {
      envelope = record(await readReferenceJson(request), ["contract", "operation", "operationId", "sourceSha256", "payload", "intentSha256", ...(version === 2 ? ["expectedSourcePolicyBasisSha256"] : [])]);
      if (typeof envelope.operation !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,59}$/.test(envelope.operation) || typeof envelope.operationId !== "string" || !UUID.test(envelope.operationId) || typeof envelope.intentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(envelope.intentSha256)) throw new Error("Invalid envelope");
      operation = envelope.operation; operationId = envelope.operationId; intentSha256 = envelope.intentSha256;
      if (version === 2 && envelope.expectedSourcePolicyBasisSha256 !== null && (typeof envelope.expectedSourcePolicyBasisSha256 !== "string" || !/^[a-f0-9]{64}$/.test(envelope.expectedSourcePolicyBasisSha256))) throw new OperationInputError("Invalid expected source policy");
      payload = record(envelope.payload, [], Object.keys(envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {}));
      if (envelope.contract !== contract) return respond({ outcome: "error", code: "contract_mismatch" }, 409);
      if (envelope.sourceSha256 !== bound.source.sha256) return respond({ outcome: "error", code: "source_mismatch" }, 409);
      const { intentSha256: ignored, ...intent } = envelope; void ignored;
      if (digest(intent) !== intentSha256) return respond({ outcome: "error", code: "intent_digest_mismatch" }, 409);
    } catch (error) {
      const code = error instanceof ReferenceBodyError ? error.code : "invalid_operation_envelope";
      return respond({ outcome: "error", code }, code === "request_aborted" ? 499 : code === "body_capacity_exceeded" ? 413 : 400);
    }
    if (!authorize) return respond({ outcome: "held", code: "authorization_binding_required" }, 503);
    try {
      const authorization = await authorize(Object.freeze({ request, operation, operationId, intentSha256, payload: freeze(payload) }));
      if (authorization !== "allow") return respond({ outcome: authorization === "deny" ? "error" : "held", code: authorization === "deny" ? "access_denied" : "authorization_unavailable" }, authorization === "deny" ? 403 : 503);
    } catch { return respond({ outcome: "held", code: "authorization_unavailable" }, 503); }
    if (request.signal.aborted) return respond({ outcome: "error", code: "request_aborted" }, 499);
    if (version === 2 && !(operation === "capabilities" && envelope.expectedSourcePolicyBasisSha256 === null) && envelope.expectedSourcePolicyBasisSha256 !== basis!.basisSha256) return respond({ outcome: "error", code: "stale_source_policy_basis", saved: false }, 409);
    if (HELD.includes(operation as typeof HELD[number])) return respond({ outcome: "held", code: "operation_not_bound", operation, saved: false }, 422);
    if (!SUPPORTED.includes(operation as typeof SUPPORTED[number])) return respond({ outcome: "error", code: "unsupported_operation" }, 400);
    try {
      if (operation === "capabilities") {
        record(payload, []);
        return respond({ outcome: "capabilities", source: bound.source, supported: SUPPORTED, held: HELD, replacementProteinRule: version === 2 ? REPLACEMENT_RULE_V2 : REPLACEMENT_PROTEIN_RULE, ...(version === 2 ? { sourcePolicies: { session: contract, referencePrices: basis!.referencePricePolicy, tapCookingWater: basis!.utilityPolicy, sourcePolicyBasisSha256: basis!.basisSha256 } } : {}), persistenceBound: false, hostedAuthorizationVerified: false, commercialAccessVerified: false, liveStorePricing: false, apiAccepted: false });
      }
      if (operation === "preparePantry") {
        record(payload, ["entries"]); const prepared = bound.planner.preparePantry(payload.entries);
        return respond(prepared);
      }
      const fields = operation === "planJoined" ? ["request", "searchGrid"] : operation === "evaluateJoined" ? ["request", "assignments"] : operation === "findReplacements" ? ["request", "assignments", "candidateGrid"] : operation === "previewReplacement" ? ["request", "assignments", "intent"] : ["request", "assignments", "confirmation", "expectedPantryBasisSha256"];
      record(payload, fields, ["pantryEntries"]);
      const selected = copyReferenceData(payload.request) as Data;
      if (!selected || typeof selected !== "object" || Array.isArray(selected) || !Array.isArray(selected.pantry) || selected.pantry.length !== 0) return respond({ outcome: "error", code: "raw_pantry_entries_required" }, 400);
      let pantryEvidence: unknown = null;
      if (Object.hasOwn(payload, "pantryEntries")) {
        const prepared = bound.planner.preparePantry(payload.pantryEntries);
        if (prepared.outcome !== "prepared") return respond(prepared);
        selected.pantry = prepared.pantry; pantryEvidence = prepared;
      }
      const pantryBasisSha256 = digest({ entries: Object.hasOwn(payload, "pantryEntries") ? payload.pantryEntries : null, prepared: pantryEvidence });
      if (operation === "confirmReplacement" && payload.expectedPantryBasisSha256 !== pantryBasisSha256) return respond({ outcome: "error", code: "stale_pantry_basis" }, 409);
      const planner = bound.planner;
        const result = (version === 2 && operation === "planJoined" ? options.newWeekRequestPolicy?.(selected) : null) ?? (operation === "evaluateJoined" ? planner.evaluateJoined(payload.assignments, selected) : operation === "planJoined" ? planner.planJoined(selected, payload.searchGrid) : operation === "findReplacements" ? planner.findReplacements(payload.assignments, selected, payload.candidateGrid) : operation === "previewReplacement" ? planner.previewReplacement(payload.assignments, selected, payload.intent) : planner.confirmReplacement(payload.assignments, selected, payload.confirmation));
      if (result.outcome === "success") {
        const presented = week(result); return respond({ ...presented, pantryBasisSha256, ...("search" in result ? { search: result.search } : {}) });
      }
      if (result.outcome === "preview") {
        const presented = presentReplacement(result, configured); if (presented.outcome !== "replacement-preview") return respond(presented);
        const meal = presentRecipe(result.after, result.target.personId, result.target.assignmentId, images); if (meal.outcome !== "recipe") return respond(meal);
        return respond({ ...presented, meal, pantryBasisSha256 });
      }
      if (result.outcome === "alternatives") return respond({ ...presentAlternatives(result, configured, images), pantryBasisSha256 });
      if (result.outcome === "proposal") return respond({ ...week(result.evaluation), target: { personId: result.personId, assignmentId: result.assignmentId }, previewSha256: result.previewSha256, pantryBasisSha256, saved: false });
      return respond(result, result.outcome === "error" ? result.code === "internal_evaluation_error" ? 500 : 400 : 200);
    } catch (error) { return respond({ outcome: "error", code: error instanceof OperationInputError ? "invalid_operation_payload" : "internal_operation_error" }, error instanceof OperationInputError ? 400 : 500); }
  }
  return Object.freeze({ outcome: "ready", handle, source: bound.source });
}
