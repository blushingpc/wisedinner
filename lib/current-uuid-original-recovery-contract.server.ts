import type { DeletionProvider } from "./account-deletion.ts";

// Private composition shape only. This does not issue a scope, invoke a provider,
// approve a policy, or make a public status request advance a worker.
export type CurrentUuidOriginalRecoveryStrategy = Readonly<{
  forOwner(ownerId: string): Readonly<Required<Pick<DeletionProvider, "reconcile">>>;
}>;
