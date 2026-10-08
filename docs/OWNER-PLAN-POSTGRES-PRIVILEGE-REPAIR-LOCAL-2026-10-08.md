# Owner plan privilege repair, October 8, 2026

Launch gate CLOSED. Verification is LOCAL. The unbound connection candidate now checks creation, sequence and ownership capabilities for its exact login/authenticated/stage membership closure. Independent security acceptance and an exact reviewed physical target remain OPEN. Nothing was connected, installed or granted externally.

Baseline adcf9ac886acfbc15b62430e7078a06a5f88c257, codex/backend-readiness; app ada176827e13c0b157bcdd8b839f14a8f83b9475. Empty indexes and inherited notes/reports were preserved. Source commit a47026cf4891cd8f87c9dcfa662107fa58e2b07c owns only lib/owner-plan-postgres.ts, its test and the new test-only privilege/admission fixture. Server/codec/account, migrations 0015/0016/0017, pg8.23.1 and dependency lock are unchanged. Runtime dependency closure remains pg, node:async_hooks, account and server types; PGlite/app admission are test-only.

The original exported preflight accepted stage database CREATE while the NOINHERIT login lacked it. Red-2 records the genuine false-expected/true-actual failure. The repair uses effective PostgreSQL privilege functions across all three members, requires SET capability, and rejects database CREATE/TEMP, non-system schema CREATE, sequence USAGE/SELECT/UPDATE and object ownership. Existing role, table/function, replay and RLS rules are retained. CONNECT and schema USAGE remain intended capabilities. PostgreSQL documents privilege checks and SET/INHERIT membership separately: [privilege functions](https://www.postgresql.org/docs/current/functions-info.html), [role membership](https://www.postgresql.org/docs/current/role-membership.html).

The genuine narrow SQL fixture runs the installed preflight and adapter before BEGIN, then the actual repository, codec, current canonical app admission and memory SQL. It saves, reads and replays the original receipt, preserving B. Twenty-eight adverse configurations each prove exported SQL refusal and installed adapter refusal before any body: each role's creation/sequence privileges, effective PUBLIC/inherited grants, ownership despite revoked ACLs, nested forbidden membership and missing SET capability. Setup grants/revokes/session authorization are ephemeral memory-only. No superuser production default is introduced.

Evidence directory: C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T20-39-28-943Z-863695e6/nodes/A2-pg-privilege-repair. plan.md precedes source edits; evidence-index.json records exact commands, UTC starts/finishes, exits and raw log/source hashes. All heavy commands used unchanged resource A with backend cwd.

| Check | Actual result |
| --- | --- |
| node --test --test-timeout=120000 lib/owner-plan-postgres.test.ts, focused-2 | exit 0, 42 distinct leaf controls; 43 including group |
| node --test --test-timeout=120000 lib/owner-plan-flow.test.ts, joined-1 | exit 0, six scenarios; seven including group |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | exit 0 |
| Effective scoped syntax lint, three owned files | exit 0, 59 rules, no errors/warnings |
| node scripts/voice-lint.ts | exit 0, voice clean |
| git diff --check, scoped owned files | exit 0 |

Do not sum retries or historical 169 controls. The 42 focused controls include 13 retained driver/security controls, one genuine SQL positive and 28 adverse cases. Joined six scenarios are a separate composition level. Original timeout/drain/stale-handle/release/discard/unknown-commit/no-retry behavior remains unchanged.

Failures remain preserved: red-1 exit1 was a fixture schema-USAGE prerequisite; red-2 exit1 is the real reproduced gap. Focused-1 exit1 had a mistaken expected release count of five for four transactions; the narrow count repair also asserts four BEGINs without weakening security assertions. Before bytes and logs remain. Evidence helper attempts additionally encountered Git quoted-path parsing and a guessed migration filename; successors use NUL-delimited paths and the actual existing filenames. They are administrative failures, not product passes. Historical missing exits, failed/held turns and blocked checkpoints are untouched.

PGlite executes actual permission SQL but serialized memory session authorization is not a real least-privilege login, physical multi-connection/JWT/PostgREST or hosted proof. All adverse cases ran without skips. Parent A2/security target use remain OPEN until capable independent repair review and exact target/privilege inventory. No broad service role, connection, migration or provider activation is authorized by these results.

Rollback: withhold the unbound adapter and unapplied migrations; reverse only the scoped source commit if needed. No reset/drop/cleanup or history replacement. Next local node is B3-native-billing-identity. Trusted production canonical admission, reviewed physical transaction target, hosted/provider/native purchase/restore/deletion reconciliation, actual recipe/source/equipment and original-inventory reroll, food/store-price and release acceptance remain gates. Targets October9 12:06UTC and19:39:35UTC remain; $0.

Learning: keep role flags separate from effective ACL proof, and test intended positive acceptance plus adverse settable-role grants with real SQL. No managed skill was changed or untested learning supplement adopted.
