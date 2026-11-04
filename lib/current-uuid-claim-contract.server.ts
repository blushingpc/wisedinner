import type { DeletionProvider, DeletionTarget, VerifiedDeletionIdentity } from "./account-deletion.ts";
import type { AppleData } from "./apple-token-custody.server.ts";
import type { ScopeAdmission } from "./current-auth-scope.server.ts";
import type { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";

// Private composition interfaces. None are endpoint DTOs, activation flags or
// destructive-scope proof. A real final UUID preflight must still issue proof.
export type CurrentUuidClaimIssueRequest = Readonly<{
  phase: "run" | "reconcile";
  target: DeletionTarget;
  fence: Readonly<AppleData>;
}>;
export type CurrentUuidIssuedClaimScope = Readonly<{
  phase: "run" | "reconcile";
  admission: ScopeAdmission;
  writerManifestSha256: string;
  writerCatalogSha256: string;
}>;
export type CurrentUuidClaimScopeIssuer = Readonly<{
  issue(input: CurrentUuidClaimIssueRequest): Promise<CurrentUuidIssuedClaimScope | null>;
}>;
export type CurrentUuidOwnerAuthPort = Readonly<{
  verifyIdentity(userId: string): Promise<VerifiedDeletionIdentity | null>;
  auth: DeletionProvider;
}>;
export type CurrentUuidClaimAuthStrategy = Readonly<{
  profile: typeof UUID_DELETE_PROFILE;
  forOwner(ownerId: string): CurrentUuidOwnerAuthPort;
}>;
