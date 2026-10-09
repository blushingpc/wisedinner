# Email Auth compatible change plan, October 9, 2026

The exact email provider transition package is implemented and verified LOCAL. It proposes six-digit codes for both first signup and repeat login, preserves the original nonsecret rollback fields, and refuses source/config/template drift. No provider setting or mail send was performed. All activation remains OFF; all 15 parents and G remain OPEN.

## Plan and ownership

Current node: A1-email-auth-compatible-change-plan-local. Plan and complete submitted instruction were saved before product edits in C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-09T07-25-06-815Z-91dcf738/nodes/A1-email-auth-compatible-change-plan-local. The frozen API code base is backend d8ec162d9328afd3b8c0b1b95aa7ab1731760713 on codex/backend-readiness and app b49f4a9e5c917fb294f0d157eddba440dcd2ab9d on main. Starting indexes were empty. The implementation commits are backend bf817e495c733455dcd016a320677a729e6aee70 and app 0a2507ce6c6b475c38737e2a1cf3c667641f1ecf. Report snapshot commits/hashes and final indexes are recorded in the immutable checkpoint.

Owned source: scripts/providers/email-auth-change-plan.ts and its focused test; app tests/native-auth-binding.test.ts only. Both paired reports and four dated note suffixes are owned. App production source is unchanged. There is no executor, credential loader, network dispatcher, route/UI edit, package/config change, source-family repin or activation in the product package. Management read and artifact-generation helpers are evidence-only CURRENT files.

Reader/writer map: the actual app native-sdk invokes installed Supabase signInWithOtp, then verifyOtp with type email. SessionBoundary independently calls getUser and requires email_confirmed_at before issuing its current owner capability. Startup/cancel/logout/late response/protected storage remain fenced. SDK returned user, local records and the prospective artifact grant no identity/access. Backend lib/account.ts independently calls /auth/v1/user and checks bearer claim/issuer/audience/sub/role/expiry consistency; its verifier does not itself contain an explicit email_confirmed_at check. Existing account/recent-auth deletion/notification contracts and disabled route settings are unchanged. This package does not establish hosted verified-email/account acceptance.

Supabase/auth-js and supabase-js are actually installed at 2.117.3. SDK source signInWithOtp forwards shouldCreateUser as create_user; the implicit email code path sends no PKCE challenge. verifyOtp forwards email/token/type=email to /verify and returned credentials are separately checked by the installed app boundary. These are actual SDK transport tests with synthetic HTTP/SecureStore; no hosted user was created.

## Actual read and prospective delta

One expressly authorized management GET to https://api.supabase.com/v1/projects/zpvqxtklvjitofpbddrn/config/auth returned 200. The safe observation completed at 2026-10-09T07:34:45.908Z, with a 15-second/262144-byte bound, redirect refusal and zero retries. Coordinator readiness SHA d9fe2d94c8e0e8c7dbdac0308a69dcd35f955a044d7b7672c145821e3ade758c matched. The script persisted only 11 owned nonsecret field slots, 14 nonsecret guard slots, template/other-subject hashes and the absent password state. It rejected nonempty SMTP/OAuth credentials or email hook values and any pinned guard/template mismatch. No full response, secret, recipient or email body for a customer was logged. The existing Resend DPAPI sending store was never read/decrypted.

| Owned field | Observed before | Proposed after |
| --- | --- | --- |
| mailer_otp_length | 8 | 6 |
| mailer_otp_exp | 3600 seconds | 600 seconds |
| smtp_host | null | smtp.resend.com |
| smtp_port | null | string 465 |
| smtp_user | null | resend |
| smtp_admin_email | null | no-reply@mail.wisedinner.com |
| smtp_sender_name | null | WiseDinner |
| mailer_subjects_confirmation | Confirm your email address | Your WiseDinner sign-in code |
| mailer_subjects_magic_link | Your sign-in link | Your WiseDinner sign-in code |
| mailer_templates_confirmation_content | Original link template, preserved byte-for-byte | Exact Token body below |
| mailer_templates_magic_link_content | Original link template, preserved byte-for-byte | Exact Token body below |

The SMTP password is a separate reference to the existing sending-only key 8a83ae78-95d9-4b1e-90ab-f488453eab56, mail.wisedinner.com and C:/Users/borgh/AppData/Local/WiseDinner/secrets/auth-mail/resend-sending.dpapi. No value appears in fields or artifacts; they cannot be sent as a ready PATCH. Original smtp_pass state is exactly null. No new key/domain/login is requested.

Exact proposed body, for both templates:

```html
<h2>Your WiseDinner sign-in code</h2>
<p>Enter this six-digit code in WiseDinner:</p>
<p><strong>{{ .Token }}</strong></p>
<p>This code expires in 10 minutes and can be used once. If you did not request it, ignore this email.</p>
```

Both bodies are necessary. Current official Auth source routes an absent/unconfirmed user through signup confirmation when auto-confirm is false; a confirmed user receives magic-link mail. OTP type email checks confirmation/recovery token paths and maps to signup or magic-link verification. Installed request modes true/false and independent /user checks are exercised locally. Current hosted server revision and delivered template choice still require isolated confirmation. [Supabase OTP source](https://github.com/supabase/auth/blob/master/internal/api/otp.go), [magic-link source](https://github.com/supabase/auth/blob/master/internal/api/magic_link.go), [signup source](https://github.com/supabase/auth/blob/master/internal/api/signup.go), [verification source](https://github.com/supabase/auth/blob/master/internal/api/verify.go).

600 seconds is a proposed positive expiry interval, supported by the current documented seconds-based configuration and current Auth source behavior. The guide documents the configurable expiry and cautions against intervals above 86400; it does not establish a vendor minimum for this hosted target. The Management API exposes the integer field. Exact hosted validation of 600 seconds remains UNRUN; no invented floor/default is claimed. [Passwordless guide](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [Auth configuration source](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go).

Resend documents smtp.resend.com, username resend and port 465 implicit TLS with an API key as password. The existing verified sending identity supports proposing the from address; sender delivery has not been tested. Current outbound domain TLS is Opportunistic and is an explicit SECURITY hold until a separately reviewed Enforced step. Port 465 does not resolve that separate delivery-policy hold. [Resend SMTP documentation](https://resend.com/docs/send-with-smtp).

## Compatibility, refusal and rollback

Only the listed owned fields are proposed. Recovery/email-change/invite/reauthentication template bodies and subjects remain unmodified; their hashes are bound. Current frequency 60, email rate 2, OTP rate 30, verified-email protections, signup/OAuth, site localhost and empty redirects remain unchanged. Rates/Resend free quotas are dated observations, not usable launch capacity proof.

Global OTP length affects newly generated email codes. Confirmation changes also affect other signup confirmation consumers; magic-link changes affect existing link consumers. Global expiry governs email codes and signup/recovery/email-change/invitation links, including outstanding requests evaluated with the current configuration. SMTP changes route all shared Auth mail, including unchanged templates. Eight-digit in-flight messages remain incompatible with the six-digit app. A transition must explicitly resolve mixed versions, shared consumers and outstanding messages in isolation; accepting eight digits in the app is not proposed.

Coordinator's limited engine/website source search found no Auth mail caller in the inspected seams and observed service clients with session persistence/refresh/URL detection off. This does not inventory unseen deployments, operators or existing recovery consumers. No engine, website checkout, customer or Auth-user inventory was accessed by this writer. Unobserved provider fields/secret values are not claimed fully inventoried or compared; the package always retains fresh external compatibility/security review holds.

The pure builder binds the full whitelisted before observation, all template digests and frozen API source pins. Presence slots distinguish missing/null/empty; absent or altered expected fields fail closed. Bounded own-descriptor parsing rejects getters, prototypes, sparse arrays, unknown fields, symbols, invalid numbers, excessive size/depth and noncanonical/duplicate JSON keys. No caller approval flag/hash can grant dispatch. Exact body and operation digest are deterministic and deeply frozen. Corrupted fields/body/key refuse serialization.

Forward and rollback states are PREPARED_HELD with dispatchAuthority NONE. A known matching nonsecret after-state permits only a held owned-field rollback candidate; any scoped after/template/rate/other-actor drift refuses. The artifact retains original null SMTP fields and exact original subjects/template strings. Password correspondence cannot be proved from a management read: private credential comparison and isolated null-clearing behavior are explicit prerequisites before restoring smtp_pass. A present-unverified password marker is data, not a proof that the installed key matches. Missing/null/empty are never silently substituted. Unknown write outcome produces HELD without replay or a rollback body. There is no write path to overwrite another actor.

Rollback of this LOCAL code is a reviewed additive revert of the new scripts/test changes and report/note suffixes preserving intervening edits. Provider rollback is separately held as described; no reset, data/key deletion or old command replay.

## Exact evidence

CURRENT node is C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-09T07-25-06-815Z-91dcf738/nodes/A1-email-auth-compatible-change-plan-local. Complete actual wrapper arguments/cwd/fixture context/start/end/exit/output SHA and copied resource receipts are in evidence-ledger.json. All heavy commands used the unchanged resource A wrapper sequentially; memory reserve 1024 MiB and admission 600 MiB were retained. Tests enforce 60000 ms. Other finite types/lint/config/voice commands exited naturally; no process timeout/stop or safety bypass occurred.

13 final builder +29 actual SDK binding +19 existing deletion-composition names =61 distinct current passing runtime names. Repeated early builder checks are not added to that count. No predecessor passes are counted anew. Native fixtures do not prove actual SecureStore/disk crash or hosted mail. Final compiler and effective lint configs are preserved; actual app strict and noUncheckedIndexedAccess are true. App lint explicitly used the installed backend TypeScript rules for the changed test; no Expo lint config was generated. Backend voice passed; no build/export/device check was needed or performed for this script/test-only scope.

| Output | Exit | Raw SHA256 |
| --- | --- | --- |
| native-auth-first.log | 0 | 64abcaf441c5d345194f3fd81efabb8eab24b2e3f93b313f0424073cad9e0b96 |
| app-types-final.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| builder-final.log | 0 | 2d7ec7e2391d1ab2ade6af21846db8fa3c72d7a631d4e63d0884552d324a6a6e |
| backend-lint-final.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| app-lint-final.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| backend-types-current.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| deletion-final.log | 0 | 18967712b00f99114b628bba655d8dc05b1c3d2780e62c4045f869e50fc60004 |
| backend-effective-lint.json | 0 | 2c419f564c9fa905f780cb09ba3a44b1c4aad5ac803d3cb87d131ad768f2489d |
| app-effective-lint.json | 0 | 2c419f564c9fa905f780cb09ba3a44b1c4aad5ac803d3cb87d131ad768f2489d |
| backend-effective-types.json | 0 | 80f1719c103f29146c43fc383297099887070ebc4fb2eebd87edda6270b33b7f |
| app-effective-types.json | 0 | 7b539bef4df091e5575549126b558583d739e2b721c59756fdcd17df3673cf11 |
| voice-final.log | 0 | 0d5d1b12a968b1c9ef04130c9a63dbcd2d54f55ab2f4c36b9b32fa00e52afb9e |

The prospective complete artifacts are:
- prospective-forward.json SHA d9584d952bcd48e1ae174448c1e4be819e742e08a5ba6aa59243ea44d5365619.
- prospective-rollback.json SHA 22956ec13cb7d5fa4af37986fec2e22d5119dfb098fd866ca66f591bc3e4017b.
- prospective-unknown-outcome.json SHA 500bfe6d735ffb9a51a5d5af0a1545d5c95d8ac6dc1d1e437b6c6996869f3efb.
- Original nonsecret auth-owned-before.json raw SHA 7f9df067014b1627084f1eaf5d0bd868f405489cd5e5f3695d9c1283eb1a0497; canonical binding 5697760229a6ecae7251be9003557d5031486c1fb6588e80943fe67933e5104f.
- Stable prospective operation 1a25dc6d1c071c738e0e2a14e4981d641b2677b4ccfdc7608ae064e884fef51b.

Product source hashes: builder 4a0697d00c4060ea2f94f48470120a2a77d408b32cdf7cc0d56a32e13a1c2fea; builder test 08262fe2fda9005c5acf8c636a0ad284b96df6b74a28676354ffe4b115647f14; app SDK test dcf0cfdb34167c564dd2e1a411c7ad42ba129986a51916f5909a588c6b781a90. Actual native-sdk 19a19e274c7355aac2354d1d80de4a54b29a567ca06526040f786c96fa293352, SessionBoundary 1a38eabf3970c974850c3807c99756ad42311db2dc94ba1600ea0a6a9458c609, backend account ffe836ee9db2ac11178168d579c1391d86318da19aa5956614c96595dbf4a86b and installed GoTrueClient source 7552500e375665e28acf23fb552ccbf1ef11379afab15859b2f670f1ae9aee9f remain unchanged. Code-base commit pins refer to these preserved pre-package API snapshots; current implementation/report commits are separately bound, not falsely described as the old HEAD.

All 15 resource commands closed and released:10 creation identities observed,5 fast identities unavailable and retained UNKNOWN. Resource receipts carry actual times/identities; no missing identity is reconstructed. The original backend compiler attempt exited2 on an assert.throws overload in the new test helper. Its raw log and pre-repair test bytes are retained; only the optional-argument branch was narrowed. Initial artifact generation exited1 because the Windows import used a plain C: path; original helper/log are preserved and the successor uses file:/// explicitly. Initial preservation capture exited1 on foreign sandbox ownership for the app; it made only backend before copies, then the diagnosed read-only owner-context successor verified those copies and completed app capture without trust changes. Guessed source filenames/Windows glob reads failed and remain diagnostic history, not product passes. Tool-only read diagnostics have no originally redirected shell log; their availability is stated in the failure ledger. No learning/managed-cache adoption is claimed.

Initial report staging also failed its required diff check because the newly authored report had an extra blank line at EOF. The original report/helper/log are preserved. Before any continuation, the exact owned stage and already appended backend suffix bytes were inspected; the successor removes only that report EOF blank and resumes from the exact stage without appending a suffix twice. The final diff check must pass; the original administrative failure remains failed.

Before capture preserved 114 regular files including all31 inherited dirty files/prefixes. Four note suffixes are appended to working bytes; only old committed note bytes plus this run's suffix are committed. Final preservation checks reopen originals/current protected source and committed owned blobs. Private-v1 pins, verbatim app core, canonical backend solver, candidate source/model/approval/food/quantity/price assets, source-family/storage protocols and production flags remain unchanged. Prior A58/A59/A60/A61 failures/seals/results/resources are not rewritten or resealed.

## Next genuine dependency and remaining tree

A1 next: coordinator reviews this exact package against a named owned isolated Auth validation target and concrete shared-consumer scope, verifies private encrypted key use and reversible before/delta/rollback/null-clearing behavior, independently reviews Enforced outbound TLS, scopes an owned no-customer recipient/send, then compares current config and independently confirms application/delivery. No target/key/domain/login provisioning or provider write is authorized here. Existing sending identity is ready; missing isolated proof and TLS are the gates.

A1-A6, B1-B6 and J1-J3 plus G remain OPEN. A2/B2 need an exact least-privilege physical database and hosted RLS/concurrency proof; A3/B3 need actual Apple/Google/store/offer/billing/explicit restore reconciliation proof; A4/A5/B4/B5 need authentic food/quantity/current location-price/shared adoption and real iPhone/cooking proof; A6/B6 need hosted lifecycle/notification/deletion/recovery acceptance. J1 needs the joined actual native/hosted flow; J2 exact accepted rollout/backup/rollback; J3 deployed smoke/recovery evidence. Prepared native producer/binding, durable inventory/reroll and local lifecycle prerequisites remain dated LOCAL checkpoints, not parents complete.

The eligible prior local flow has a current committed minimum handoff at docs/NATIVE-REVIEWED-MINIMUM-HANDOFF-LOCAL-2026-10-09.md. No new independent unblocked implementation item is identified within this exact provider-preparation scope after this node. A CURRENT next-dependency hold records the genuine external target/TLS/send prerequisites; no repeated target probes, optional guard job, auditor repair, self-dispatch or permission loop is substituted.

New spending $0. Live provider/schema/mail/purchase/restore/notification/publication/build/upload/customer operations0. Shared ce_/engine/media/website/unrelated businesses and controller/audit/HQ/settings remain untouched. Real iPhone, cooking, hosted/provider/store/SMTP, shared-source acceptance and public release remain UNVERIFIED/UNRUN. October9 12:06UTC and19:39:35UTC are retained execution targets, not fresh clocks or Apple guarantees. Final result pointer remains exactly C:/Users/borgh/Projects/wisedinner-backend/docs/EMAIL-AUTH-COMPATIBLE-CHANGE-PLAN-LOCAL-2026-10-09.md.
