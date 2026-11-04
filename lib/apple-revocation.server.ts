import type { DeletionV2Providers, DeletionV2Repository } from "./account-deletion-v2.server.ts";
import type { DeletionTarget, VerifiedDeletionIdentity } from "./account-deletion.ts";
import { appleExact, appleUuid, appleHash, appleDigest, checkedApple, appleObject, openAppleTokens } from "./apple-token-custody.server.ts";
import type { AppleData, AppleRepository, AppleClient, AppleEnvelope } from "./apple-token-custody.server.ts";

export type AppleRevocationDependencies = { repository: AppleRepository; client: AppleClient; keyring: ReadonlyMap<string, Buffer>; timeoutMs: number; verifyIdentity(id: string): Promise<VerifiedDeletionIdentity | null> };
export function createAppleRevocationProvider(input: AppleRevocationDependencies): NonNullable<DeletionV2Providers["apple"]> {
  const deps = { ...input, client: { ...input.client }, repository: { ...input.repository }, keyring: new Map([...input.keyring].map(([v, k]) => [v, Buffer.from(k)])) };
  if (!Number.isInteger(deps.timeoutMs) || deps.timeoutMs < 1 || deps.timeoutMs >= 8000) throw Error("invalid_revocation_budget");
  const target = (t: DeletionTarget) => { appleExact(t, ["userId", "identityHash", "operationId"]); appleUuid(t.userId); appleUuid(t.operationId); appleHash(t.identityHash); return t; };
  const proof = (t: DeletionTarget, outcome: "confirmed" | "unknown" | "failed", basis: unknown) => ({ ...t, outcome, evidenceHash: appleDigest(["wd-apple-original-revocation-1", t, outcome, basis]) });
  async function aggregate(t: DeletionTarget) {
    const row = checkedApple(await deps.repository.command("revocation", "status_original", t));
    return proof(t, row.complete === true ? "confirmed" : row.refused === true && row.unknown !== true ? "failed" : "unknown", row.evidenceHash);
  }
  return {
    async run(value) {
      const t = target(value), deadline = Date.now() + deps.timeoutMs;
      const execute = async () => {
      try {
        const current = await deps.verifyIdentity(t.userId);
        if (!current || current.identityHash !== t.identityHash || Date.now() >= deadline) return proof(t, "unknown", "current-parent-identity-changed-or-deadline");
        const snapshot = checkedApple(await deps.repository.command("revocation", "snapshot_original", t));
        if (snapshot.fresh !== true) return await aggregate(t);
        if (!Array.isArray(snapshot.credentials) || snapshot.credentials.length > 32) return proof(t, "unknown", "inventory-unverified");
        for (const row of snapshot.credentials) {
          if (Date.now() >= deadline) break;
          const c = appleExact(row, ["lineageId", "envelope"]), lineageId = appleUuid(c.lineageId), envelope = appleObject(c.envelope) as AppleEnvelope;
          // Historical ownership comes from immutable admitted owner/client/AAD,
          // not current Auth provider membership. No body-supplied subject grant.
          if (envelope.binding.ownerId !== t.userId || envelope.binding.lineageId !== lineageId || envelope.binding.clientId !== deps.client.clientId) continue;
          let token: string;
          try { token = openAppleTokens(envelope, deps.keyring).refresh_token; } catch { continue; }
          const started = checkedApple(await deps.repository.command("revocation", "begin_original", { ...t, lineageId }));
          if (started.fresh !== true || Date.now() >= deadline) continue;
          let timer: ReturnType<typeof setTimeout> | undefined;
          let outcome: "confirmed" | "refused" | "unknown" = "unknown";
          try { const yes = await Promise.race([deps.client.revoke(token), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("original_unknown")), Math.max(1, deadline - Date.now())); })]); outcome = yes ? "confirmed" : "refused"; } catch { /* original remains unknown; ciphertext retained */ } finally { clearTimeout(timer); }
          await deps.repository.command("revocation", "record_original", { ...t, lineageId, outcome, evidenceHash: appleDigest(["wd-apple-revoke-observation-1", t, lineageId, outcome]) });
        }
        return await aggregate(t);
      } catch { return proof(t, "unknown", "original-unverified"); }
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([execute(), new Promise<ReturnType<typeof proof>>(resolve => { timer = setTimeout(() => resolve(proof(t, "unknown", "whole-provider-budget-exhausted")), deps.timeoutMs); })]); }
      finally { clearTimeout(timer); }
    },
    async reconcile(value) { const t = target(value); try { return await aggregate(t); } catch { return proof(t, "unknown", "original-status-held"); } }
  };
}

// Construct per accepted service request. No global request cache or source
// writer. Main separately admits the eventual frozen-route composition.
export function createAppleCustodyDeletionPorts(deps: { repository: AppleRepository; original: DeletionV2Repository; verifyIdentity(id: string): Promise<VerifiedDeletionIdentity | null>; auth: DeletionV2Providers["auth"]; apple: NonNullable<DeletionV2Providers["apple"]> }): { providers: DeletionV2Providers; repository: DeletionV2Repository } {
  let basis: AppleData | undefined;
  return {
    providers: {
      async verifyIdentity(id) {
        const current = await deps.verifyIdentity(id); if (!current || !["linked", "none"].includes(current.apple)) return null;
        const history = checkedApple(await deps.repository.command("deletion", "effective_basis", { userId: id }));
        if (!["empty", "present", "unknown"].includes(String(history.history))) return null;
        const effective = current.apple === "linked" || history.history !== "empty" ? "linked" : "none";
        const evidenceHash = appleDigest(["wd-apple-effective-deletion-basis-1", current, history]);
        basis = { userId: id, currentIdentityHash: current.identityHash, actualApple: current.apple, effectiveApple: effective, inventoryRevision: history.revision, inventoryHash: history.inventoryHash, identityEvidence: evidenceHash };
        return { ...current, apple: effective, evidenceHash };
      },
      auth: deps.auth, apple: deps.apple
    },
    repository: {
      account: (...args) => deps.original.account(...args),
      async worker(action, body) {
        if (action !== "admit") return deps.original.worker(action, body);
        if (!basis || basis.userId !== body.userId || basis.currentIdentityHash !== body.identityHash || basis.identityEvidence !== body.identityEvidence || basis.effectiveApple !== body.appleLinkage) throw Error("effective_basis_unverified");
        return checkedApple(await deps.repository.command("deletion", "admit_original", { original: body, basis }));
      }
    }
  };
}
