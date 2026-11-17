import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";
import type { ReferenceWeek, ReferenceWeekV2 } from "./generated-plan-state.ts";
import { readCurrentBundledCapsule } from "./current-bundled-capsule.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { createCurrentIntegrationReferenceV5, CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY } from "./current-integration-reference-v5.server.ts";
import { createCurrentIntegrationReferenceV6, CURRENT_INTEGRATION_REFERENCE_V6_IDENTITY } from "./current-integration-reference-v6.server.ts";
import { createCurrentIntegrationReferenceV7, CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY } from "./current-integration-reference-v7.server.ts";
import { createCurrentIntegrationReferenceV9, CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY } from "./current-integration-reference-v9.server.ts";
import { createCurrentIntegrationReferenceV10, CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY } from "./current-integration-reference-v10.server.ts";
import { createCurrentIntegrationReferenceV11, CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY } from "./current-integration-reference-v11.server.ts";
import {
  createCurrentIntegrationSuccessorReference,
  CURRENT_INTEGRATION_SUCCESSOR_IDENTITY,
  CURRENT_INTEGRATION_HOUSEHOLD_IDENTITY,
} from "./current-integration-reference-successor.server.ts";
import {
  createCurrentIntegrationDietaryReference,
  CURRENT_INTEGRATION_DIETARY_IDENTITY,
  CURRENT_INTEGRATION_STRICT_DIETARY_IDENTITY,
} from "./current-integration-reference-dietary.server.ts";
import { CURATED_LOCAL_QA_PIN as archiveMethodPin } from "./generated-curated-archive-method-policy.ts";
import { CURATED_LOCAL_QA_PIN as archiveDietaryPin } from "./generated-curated-archive-dietary-policy.ts";

type ArchiveBinder = Pick<CurrentIntegrationSource, "sourceSha256" | "sourcePolicyBasisSha256" | "bind">;
type ArchiveIdentity = Pick<CurrentIntegrationSourceIdentity, "sourceSha256" | "sourcePolicyBasisSha256">;
const v4: ArchiveIdentity = Object.freeze({
  sourceSha256: "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c",
  sourcePolicyBasisSha256: "6416f956c50b380e4cbd11d223c9095642487cf028142e58aaff80419e5628f4",
});

const archives: ReadonlyArray<readonly [ArchiveIdentity, (now: () => number) => ArchiveBinder]> = [
  [v4, now => createReviewedCurrentSourceBinder(JSON.parse(readCurrentBundledCapsule("v4", import.meta.url)), now)],
  [CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY, createCurrentIntegrationReferenceV5],
  [CURRENT_INTEGRATION_REFERENCE_V6_IDENTITY, createCurrentIntegrationReferenceV6],
  [CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY, createCurrentIntegrationReferenceV7],
  [CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY, createCurrentIntegrationReferenceV9],
  [CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY, createCurrentIntegrationReferenceV10],
  [CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY, createCurrentIntegrationReferenceV11],
  [CURRENT_INTEGRATION_SUCCESSOR_IDENTITY, now => createCurrentIntegrationSuccessorReference(now, false)],
  [CURRENT_INTEGRATION_HOUSEHOLD_IDENTITY, now => createCurrentIntegrationSuccessorReference(now, true)],
  [CURRENT_INTEGRATION_DIETARY_IDENTITY, now => createCurrentIntegrationDietaryReference(now, false)],
  [CURRENT_INTEGRATION_STRICT_DIETARY_IDENTITY, now => createCurrentIntegrationDietaryReference(now, true)],
];
const inheritedSources = new Set<string>([archiveMethodPin.sha256, archiveDietaryPin.sha256]);

export function fixedArchiveResolver(
  owner: Parameters<CurrentIntegrationSource["bind"]>[0],
  transactions: Parameters<CurrentIntegrationSource["bind"]>[1],
  now: () => number,
) {
  const binders = new Map<string, ArchiveBinder>();

  return async (week: ReferenceWeek) => {
    const basis = (week as ReferenceWeekV2).sourcePolicyBasis?.basisSha256;
    if (!basis) return undefined;
    // V10 and V11 can share a basis. Keep the predecessor resolver's order.
    const entry = archives.findLast(([identity]) =>
      identity.sourceSha256 === week.sourceSha256 && identity.sourcePolicyBasisSha256 === basis);
    if (!entry && !inheritedSources.has(week.sourceSha256)) return undefined;
    const key = entry ? week.sourceSha256 + "/" + basis : "dietary-inherited";
    let binder = binders.get(key);
    if (!binder) {
      binder = entry ? entry[1](now) : createCurrentIntegrationDietaryReference(now, false);
      if (entry && (binder.sourceSha256 !== week.sourceSha256 || binder.sourcePolicyBasisSha256 !== basis)) return undefined;
      binders.set(key, binder);
    }
    const bound = await binder.bind(owner, transactions);
    const result = await bound?.presentSavedWeek?.(week) as {
      sourceSha256?: string;
      sourcePolicyBasisSha256?: string;
      view?: { outcome?: string };
    } | undefined;
    return result?.sourceSha256 === week.sourceSha256 &&
      result.sourcePolicyBasisSha256 === basis && result.view?.outcome === "saved-week" ? result : undefined;
  };
}
