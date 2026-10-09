# Verified email account boundary, October 9, 2026

The backend HTTP verifier now requires a real server email-confirmation timestamp before producing VerifiedAccount. The actual installed account/SDK/durable-owner/deletion paths pass 44 distinct final LOCAL leaves. The full required nearest owner-plan suite remains BLOCKED by a pre-existing source-pin mismatch; this node is not verified-local as a whole. Activation OFF, all15 parents and G OPEN. No provider, database, mail, native or publication operation occurred; new spending $0.

## Plan, source and responsible boundary

Current plan and full submitted instruction are under C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-09T08-31-53-804Z-838dce45/nodes/A1-verified-email-account-boundary-local. Starting backend 8df3f267227bec7176b4e5f48b90221e515a0011 and app 6bcaffd19d62a748761d7cd87f42487bec4cb664 matched, both indexes empty. Before capture reopened 124 regular files, including all31 inherited files/prefixes. Current source implementation commit: 36a7c9b63c6f1934eb7ef004edd149ac389b86e1. App production and test source remains unchanged; its later report/note commit is independently recorded in CURRENT. Granular source diff is source-owned.diff; the final checkpoint records real report/source commits and raw committed blobs rather than claiming a prospective commit hash.

Cause reproduced before the fix: supabaseVerifier checked successful independent Auth /user, nonanonymous identity and JWT consistency without checking email_confirmed_at. Null/missing server confirmation could reach the actual accountHandler and supabaseAccountRepository initialize RPC adapter with 200. Synthetic local replies expose this mechanism, not a hosted exploit. The current app native SDK already rejects missing server email confirmation after independent getUser, so no redundant app wrapper was added.

The change adds six lines inside the existing successful Auth-response/invalid_session boundary. It requires a string RFC3339 timestamp with a real calendar date, valid clock/timezone, finite positive epoch and a time no later than the current clock. Calendar normalization such as February30 and hour24 are refused. Server fractional-second/offset forms used by valid fixtures remain supported. Missing/null/empty/nonstring/whitespace/unparseable/future/phone-only confirmation cannot return VerifiedAccount. confirmed_at, phone confirmation, user_metadata.email_verified, provider labels and decoded JWT claims are not replacements. A finite current clock is required for this comparison.

Supabase documents email_confirmed_at as email confirmation, while confirmed_at may refer to email or phone. It warns that editable user metadata is unsuitable for authorization. getUser obtains authoritative data from the Auth server. [User attributes](https://supabase.com/docs/guides/auth/users), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser). Our timestamp validation is a local fail-closed boundary, not proof of actual hosted provider configuration or delivered mail.

Existing issuer/audience/role/sub/expiry, nonanonymous check, trusted identity list, signed AMR/recent deletion and error/status behavior remain unchanged. HTTPS configuration, no-store, redirect refusal and eight-second Auth timeout remain unchanged. VerifiedAccount and frozen private-v1 shape are unchanged. The same verifier is consumed by account, billing identity/access, notifications and prepared owner-plan HTTP compositions; route/config source is untouched and default-off. Four nearest backend test fixtures now explicitly state server-confirmed timestamps; no always-verified replacement or new authority is introduced.

Owned committed source pins:

- lib/account.ts: 85b337bb5c21ac36d4f40cd3f75684414eab422b698dadd094500e2f4c28fff9.
- lib/account-verified-email.test.ts: bf86c493e00197792a1fceca8627f4d919d139376ac802292bf68830cc1f6d17.
- lib/account.test.ts: 9f50975a89049eff17e1bf77ea1f2b167cd7121ec9ae837b8454504593c1c8dc.
- lib/owner-plan.test.ts: 114cba18dcf027c7e0ad3f2db928fc621274ee3230e3146adccf20d7298e45f3.
- lib/account-owner-plan-guards.test.ts: 523ad58bbab6a9b62c26e0a99ede4b62b64cf070f9bc5d216044ff50d0ac8b7a.
- lib/app-account-deletion-contract.test.ts: ca2852e510de317cea605f9d70956bb2df87650d76690b5c582ffd69b995b518.

## Reproduction and required failure

regression-red exited1 before product code repair:21 Node tests,4 pass/17 fail, including null/missing cases yielding200 instead of401 and the actual default-off route fixture yielding200. The owner-plan denial test reached a transaction stub and returned503 rather than401. Its failure demonstrates entry past the missing prerequisite, not successful storage. Original log/resource and byte-exact before account.ts remain unchanged. regression-green exited0 with all21 cases passing.

The first nearest affected command exited1:47 Node test records,33 pass/14 fail. Twelve failing legacy leaves plus two parent containers belong to lib/owner-plan.test.ts. Current account, guards, deletion and actual installed SDK-to-durable-owner flow passed. The original failed command remains required and failed, including its after-test unhandled rejection; passing successors do not reclassify it.

Read-only diagnosis found two stale values in the older 42-pin test-only owner-plan.fixture.ts:

- src/account/billing.ts: old 214703af61c86e3ba60099ba8e5e9467b99053f2b32860e190985715c8031dca (12315 bytes), actual f2db32fb4ab492df979e754843c0a934f63c5e74a45bf6ca32345cec920bab9b (16178 bytes).
- src/account/planner-state.ts: old 7b4c645617b09d7061a04ce24289e874ef90ed0c638477fa4e799585a6d1f5bc (11179 bytes), actual dad6a958732af9245c0ace6f55014ffea782762763a237270f931646620d5708 (21708 bytes).

That fixture's assertSources fails before full-state admission. Neither repaired backend account.ts nor its new timestamp field is in that pinned list. No pin, family, approval, source data, private-v1 contract or admission check was rebound/disabled. owner-fixture-pin-diagnosis.json and owner-plan.fixture.before-diagnosis.ts preserve actual complete source/pin evidence.

A diagnostic-only module hook redirected exactly lib/account.ts to the hash-checked original before copy ffe836ee9db2ac11178168d579c1391d86318da19aa5956614c96595dbf4a86b. All other current imported modules and fixture checks remained intact. The baseline successor again exited1 with the identical12 failed leaves and two failed parent containers. This establishes the failure with the pre-repair verifier. Final gates never use that hook. Its first attempt exited1 before running real leaves because a plain Windows C: --import path was rejected; the file:/// successor preserves that original failure. No compiler/import exclusion or product source change was used to manufacture a pass.

The final independent current-path command exited0 with45 Node records:44 distinct passing leaves and one parent container. It covers actual verifier/handler/RPC, versioned route, owner-plan denial, confirmed email/Apple relay-compatible/Google fixture paths, account management/recent-auth/deletion and real installed SDK/root/durable transport/serialized memory SQL/local receipt/recovery. All previously passing owner-plan-flow leaves pass using its existing unchanged confirmed native fixture. Eight additional legacy leaves were individually green inside the failed broad command; they are not represented as a passing legacy suite. Repeated runs, parent containers, baseline iterations and A62 predecessor tests are not added to the44 final count. No skips/cancellations/todos in the final current-path output.

## Commands and evidence

All11 heavy commands ran sequentially through the existing lane-driver --resource A --cwd C:/Users/borgh/Projects/wisedinner-backend -- exact installed Node executable. Reserve1024MiB/admission600MiB remained unchanged. Complete actual wrapper/child arguments, cwd, fixture environment, start/end, exit/signal, stdout/stderr raw hashes and copied resource receipts are in evidence-ledger.json and each .command.json. Tests specify120000/180000ms and test-concurrency1 for multi-file memory fixtures. Other finite types/lint/config/voice commands ended naturally; no process-stop timeout or bypass was used.

| Raw output | Exit | SHA256 |
| --- | --- | --- |
| regression-red.log | 1 | 824ad54c66987903ce0590e827a5ce6530cfb7c5192ecfc08ba6f127b291a0da |
| regression-green.log | 0 | 32d090088cd2888fa96d13e2a68d2a0b33bab8c161879ca250fe70a125a27d24 |
| affected-final.log | 1 | e8de492a95e93db9bdcd89442fd8a5a2921fdaa4837a109279ae521f9066adb2 |
| owner-plan-baseline.log | 1 | 53b4d6b6786e554ad464401c74da4c6b2bb7b3851bfcd56fccceb7637ab1b229 |
| owner-plan-baseline-successor.log | 1 | a821ee29bd010a4d3e5d035ebfbb35303a5b9b22320a8227820ffe60e4df8e82 |
| backend-types-final.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| lint-final.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| current-paths-final.log | 0 | 1c072652d4661793453c90ef548b9cf7105fb72eae417e5a2c6a2d17a4f8b5fc |
| effective-lint-final.log | 0 | 2c419f564c9fa905f780cb09ba3a44b1c4aad5ac803d3cb87d131ad768f2489d |
| effective-types-final.log | 0 | 9a1d748fd5bfdc27b156c9084f5497f215b4c546627eeae7081994a292b9c441 |
| voice-final.log | 0 | 61e4872d57b3de0e788a7ad95420adc25bdc97d62f2463ada791c33a8f1046e8 |

Backend ordinary strict types passed with no configuration change. Scoped ESLint passed on exactly the six changed backend files; actual effective parser/rules and strict config are preserved. Voice and owned working/cached diff checks pass. No app compile/suite/build/export/native capture/install was run to reconfirm unchanged source. A62 accepted native results are reusable only with current matching native-sdk/session pins and are not counted as current tests.

All11 resource commands genuinely closed/released: 6 child identities observed and 5 fast captures unavailable/UNKNOWN. Actual receipts retain those distinctions; no creation identity is reconstructed or any process stopped. Original first red/failing legacy/baseline import outputs remain failed. Initial literal-Windows-glob/guessed fixture reads and unavailable version-specific vendor-doc fetch are tool-only diagnostics without originally redirected regular logs; the failure ledger records that availability honestly. No managed skill/cache update or claimed learning adoption occurred. The repeated Windows import hazard is recorded for the next owned workflow lesson, not invented as an adopted improvement.

## Preservation, compatibility and rollback

Unchanged native SDK SHA19a19e274c7355aac2354d1d80de4a54b29a567ca06526040f786c96fa293352 and session SHA1a38eabf3970c974850c3807c99756ad42311db2dc94ba1600ea0a6a9458c609 were reopened. All four private-v1 pins, both candidate assets SHA272bb3a868ab5b25a347d3c133e7a510ad79a5eda0f0fd27efe5b84792fff362 and paired portable inventory SHA c2225014c6434af1a79e7aea3bbacd738e3a90915602272e912b92b20bf4823e match. Verbatim app core and canonical backend solver before copies remain unchanged. No food/source/approval/price/quantity/pantry/equipment/contract/config/dependency/SQL change. Exact protected paths/hashes and reused A62 anchors are in protected-pins.json. Previous results/reports/manifests/resources are not rewritten or resealed.

Own notes use four dated suffixes only. Working bytes preserve original full historical prefixes; commits contain prior committed note blobs plus only this run's suffix. Final preservation evidence reopens before copies, current protected/inherited bytes, suffixes, committed source/report/note blobs and empty indexes. Backend4/app27 inherited path sets stay the same; app tasks/QUEUE.md remains otherwise clean. No broad stage/reset/stash/checkout/cleanup. Rollback is a reviewed additive revert of this guard/tests/own suffixes, preserving intervening changes and all data.

A62 forward/rollback source artifacts remain byte-exact and now stale for dispatch because they bind the old account.ts SHA. New current account SHA85b337bb5c21ac36d4f40cd3f75684414eab422b698dadd094500e2f4c28fff9 is not silently substituted. Old provider execution stays held. A reviewed current-source successor package/config comparison and independent source validation are required before considering execution.

## Next dependency and limits

The node checkpoint is BLOCKED, proofLevel LOCAL, because required legacy owner-plan verification still fails. Immediate local successor dependency is an exact reviewed compatibility scope for the two stale test-only source bindings and their genuine current full-state admission relationship. Do not automatically repin or broaden/adopt a shared format under this guard repair. The narrow backend HTTP repair itself has passing focused proofs, but this worker does not self-accept the entire node or close A1.

Direct authenticated SQL/RPC/RLS remain a separate actual hosted-security requirement. This HTTP check does not independently enforce or prove those direct surfaces. Memory-only SQL claim fixtures do not constitute real Auth/user/RLS/two-connection acceptance; no SQL/schema/grant was changed. Current native relay/email/provider fixtures are LOCAL wiring proof, not Apple/Google/recipient/store execution.

Next provider dependency remains named owned isolated Auth/shared-consumer/mixed-version/in-flight validation, secure exact existing encrypted credential correspondence, reversible fresh config/before/delta/rollback/null-clearing review, separately reviewed Enforced outbound domain TLS, explicitly permitted owned no-customer recipient and independent application/delivery confirmation. Existing sender credential/domain is ready; no new key/domain/login request is needed. No GET/PATCH/POST/send/credential decryption/provisioning occurred in this job.

All A1-A6, B1-B6, J1-J3 and G remain OPEN. A2/B2 need owned least-privilege physical database/hosted RLS/concurrency/recovery; A3/B3 actual products/prices/trial/billing/one-owner restore; A4/A5/B4/B5 authentic food/current price/shared adoption/iPhone/cooking/replacement acceptance; A6/B6 hosted lifecycle/notification/deletion/recovery; B1/J1 actual joined verified account/native/hosted flow; J2 exact accepted rollout/backup/rollback; J3 deployed smoke/recovery. Prior local combined-flow handoff is preserved. No other new unblocked substantive implementation is identified within this exact guard scope. Save its held prerequisite plan immediately after checkpoint, with no optional guard/auditor work or repeated target probes.

$0 spending; ce_/engine/media/website/unrelated source and controller/reviews/HQ/settings remain untouched. All production factories OFF. Physical cooking/iPhone demo checks remain UNVERIFIED, and no no-pause/hosted/native/Apple/public guarantee is made. October9 12:06UTC and19:39:35UTC remain execution targets, not new clocks. Final result pointer is exactly C:/Users/borgh/Projects/wisedinner-backend/docs/VERIFIED-EMAIL-ACCOUNT-BOUNDARY-LOCAL-2026-10-09.md. Genuine turn/thread/exit/absent-owner acceptance is for coordinator after natural completion, never synthesized by the writer.
