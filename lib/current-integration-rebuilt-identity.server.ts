import type { CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

export const CURRENT_INTEGRATION_REBUILT_PROFILE = "wd-current-reference-rebuilt-v1" as const;
export const CURRENT_INTEGRATION_REBUILT_REVISION = 12 as const;
export const CURRENT_INTEGRATION_REBUILT_LAST_SERVICE_DAY = "2026-12-19" as const;

export const CURRENT_INTEGRATION_REBUILT_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  sourceSha256: "529c2ce4504378ef5a538a8def4041406c37be676fe049ea52cf03f5dfcdaec9",
  sourcePolicyBasisSha256: "0e6f4d0ec2c95c53ce31c5ce7bca8dc4ec815ec949a65b981f3e9b6532720939",
  configurationSha256: "0e1ec60b98c5ca04b8145e14bcbc4bb76f66511fcf72ef7d56cd3f18b6ff9cd4",
  reviewedDataSha256: "990cacbd91c82b2a92cd1a266d1ba5bd5d9db3cb656b44fd87834e561bf569a6",
  evidenceManifestSha256: "04e7c8ed12d93f9b81ef4894648de352f713562b9761d80294c227eeb35c247f",
  guidePolicy: Object.freeze({
    version: "wd-current-guide-policy-v1",
    sha256: "fb323f53ce5b758ae441a93662a6ebfc09cd1668b236451abd9d78b0fb395a85",
  }),
  window: Object.freeze({
    firstDay: "2026-11-02",
    lastDay: "2026-12-13",
    commitBefore: 1797206400000,
  }),
});
