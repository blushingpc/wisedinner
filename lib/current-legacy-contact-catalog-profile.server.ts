import { appleDigest } from "./apple-token-custody.server.ts";
import { CURRENT_SPARSE_CATALOG_IDENTITY } from "./current-sparse-catalog-profile.server.ts";
/** Maintained current-contact domain metadata, never private target admission. */
export const CURRENT_CONTACT_CATALOG_PROFILE = "wd-current-confirmed-contact-v1" as const;
export const CURRENT_CONTACT_CATALOG_METADATA = Object.freeze({
  parent: CURRENT_SPARSE_CATALOG_IDENTITY,
  admission190: "5508d3093f8bf7ee92f78abb8e1449b41043c36d83e761737809c74f27576148",
  authColumns189: "29bba48f53b52b3abb7250fc835ba5a83782ebc7d0cd30f95beae25357933d0c",
  source0030: "d41a71162b04abe56bd7470d3f697f5109cbfbbcc8a649b5a869a85e99d8ac65",
  migrationSha256: "ab487f8b5bfbfd7c10e1cf11e364b2401fae7c0d80fbb7d44e2b66fab75a5836",
  observer: "wd_current_contact_auth_scope_observe", barrier: "wd_current_contact_local_deletion_barrier",
  earlyPreflight: "wd_current_contact_preflight",
  contactFields: Object.freeze(["waitlist.email","support_messages.email","support_threads.from_email","support_messages_v2.thread_id","support_threads.legacy_id"]),
  limit: 10000, publicDtoChanged: false, providerPredicate: "account-uuid-only", writeFence: null,
  limits: Object.freeze(["Current confirmed contact domain only, no historical/unstructured erasure claim","Matched/ambiguous held, no cleanup or retention duration","Source metadata is not admission; private expected request/catalog/writer proof remains required"])
});
export const CURRENT_CONTACT_CATALOG_IDENTITY = appleDigest([CURRENT_CONTACT_CATALOG_PROFILE,CURRENT_CONTACT_CATALOG_METADATA]);

