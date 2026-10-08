# Owner-plan PostgreSQL type ownership repair, October 8, 2026

A2-pg-type-ownership-repair, sole writer A, current run2026-10-08T22-43-11-135Z-54696383. VERIFIED LOCAL unbound candidate. Actual exported CONNECTION_PREFLIGHT now rejects pg_type ownership in user namespaces by any exact recursively settable login/authenticated/stage member. No role closure, allowed capability, claim, replay, transaction/TLS/error or migration contract weakened.

The first fixture lookup failed because its regtype lookup required schema USAGE not granted to this narrow login. Preserve type-owner-red exit1 as a fixture failure. A catalog namespace/name lookup fixed only that test prerequisite; type-owner-red-current then failed Missing expected rejection on the actual adapter, proving body was allowed for a stage-owned enum before source repair.

Minimal production delta is two read-only SQL predicate lines. New focused test covers revoked-ACL stage enum plus nine enum/domain/free-standing composite owner combinations, inherited/settable ownership despite NOINHERIT and a positive unrelated-owned/system type fixture. Adapter preflight executes before BEGIN/body and releases once on refusal. Existing actual42 privilege/transaction leaves and six joined scenarios are freshly regressed.

ownership-current reports63 tests including three parents =60 distinct leaves:42 existing privilege/transaction,12 ownership leaves and six joined flow scenarios. Red/repeated assertions are not additional passes. Scope is installed PGlite serialized memory SQL and SDK/Auth/storage doubles in existing composition, not physical PostgreSQL ownership/permission/concurrency or hosted/native proof.

Current scoped ordinary TypeScript, effective59-rule syntax lint, backend voice and scoped/staged diff checks pass. No dependency, app source, fixed private API, solver/data, adoption,0015/0016/0017, environment/key/grant or target change. Before hash a5ac9377746e5eef1441895a6ee02fab3265a2da5a373027e0cc6a8c52a93a5c and raw before bytes retained. Account/server bytes unchanged for this node.

Official [pg_type catalog](https://www.postgresql.org/docs/current/catalog-pg-type.html) identifies typowner; [ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html) documents owner authority. This closes the confirmed catalog omission, not universal PostgreSQL security certification. Other actual target properties remain unverified.

Rollback only scoped adapter/new test via reviewed successor, preserving original reports/failures/receipts and hard-off factories. No physical connection, migration installation, shared engine/ce_ write, paid/provider/native action or publication. A2/A/B/G and food/price/device/release gates remain OPEN. No managed skill/adoption change.

Immediate next dependency within this same turn: A6-J1-strict-joined-type-repair, exact saved strict app compiler graph red then narrow fail-closed guards. October9 12:06UTC and original19:39:35UTC remain unchanged targets.

Source snapshot fc34e85da689b5fbd8a73fa6bff951e1d124f4d6. Evidence directory C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T22-43-11-135Z-54696383/nodes/A2-pg-type-ownership-repair.

| Attempt | UTC start / finish | Exit | Actual command (resource A exact recorded cwd unless resource=false) | Raw log SHA256 |
|---|---|---|---|---|
| diff-current | 2026-10-08T22:47:50.5907704Z / 2026-10-08T22:47:50.6674292Z | 0 | git diff --check -- lib/owner-plan-postgres.ts lib/owner-plan-type-ownership.test.ts | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| lint-current | 2026-10-08T22:47:35.8439705Z / 2026-10-08T22:47:38.4171624Z | 0 | C:/Program Files/nodejs/node.exe C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T22-43-11-135Z-54696383/syntax-lint.mjs C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T22-43-11-135Z-54696383/nodes/A2-pg-type-ownership-repair C:/Users/borgh/Projects/wisedinner-backend lib/owner-plan-postgres.ts lib/owner-plan-type-ownership.test.ts | 592a80b5091c8cec863f25d60011df5a578a1dcd863c0548c21fc66243f9a46f |
| ownership-current | 2026-10-08T22:46:39.5823818Z / 2026-10-08T22:46:54.3660749Z | 0 | C:/Program Files/nodejs/node.exe --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-timeout=120000 lib/owner-plan-type-ownership.test.ts lib/owner-plan-postgres.test.ts lib/owner-plan-flow.test.ts | 3f199f05b88f5b2c844d52cce5a0e880a28bcdfc6078e5959210913ab6a82faa |
| type-owner-red-current | 2026-10-08T22:45:59.0210350Z / 2026-10-08T22:46:02.4418381Z | 1 | C:/Program Files/nodejs/node.exe --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-timeout=120000 lib/owner-plan-type-ownership.test.ts | 81eb16dde865e294e11f582308ca1405fedbfe8cb8ae554dae24ab35c8d73109 |
| type-owner-red | 2026-10-08T22:45:39.7937233Z / 2026-10-08T22:45:43.8770597Z | 1 | C:/Program Files/nodejs/node.exe --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-timeout=120000 lib/owner-plan-type-ownership.test.ts | 23fcd69fb56381c34105df0cfef4be9448869957165db2b8e4856c18dfc1c278 |
| types-current | 2026-10-08T22:47:24.2212419Z / 2026-10-08T22:47:27.6280554Z | 0 | C:/Program Files/nodejs/node.exe node_modules/typescript/bin/tsc --noEmit --incremental false --project C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T22-43-11-135Z-54696383/nodes/A2-pg-type-ownership-repair/tsconfig.json | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| voice-current | 2026-10-08T22:47:47.3608969Z / 2026-10-08T22:47:49.6156080Z | 0 | C:/Program Files/nodejs/node.exe scripts/voice-lint.ts | 0d5d1b12a968b1c9ef04130c9a63dbcd2d54f55ab2f4c36b9b32fa00e52afb9e |

Source pins:

C:\Users\borgh\Projects\wisedinner-backend\lib\owner-plan-postgres.ts ae5c58b2865b0acc357b2a22fbeff6a2620e867135c0955938727ccdbfde102c
C:\Users\borgh\Projects\wisedinner-backend\lib\owner-plan-type-ownership.test.ts 6077019f63e6159947b20a581e36ebf30b02d21732569dc5760a760bbcc67c20

Exact command records contain original args/cwd and logs. Failed attempts are historical ledger entries, never verified-local required checks. Immutable checkpoint names the final passing checks. Native SDK/Auth/provider/storage fixtures are LOCAL only.
