import test from "node:test";
import assert from "node:assert/strict";
import { EMAIL_AUTH_SOURCE_PINS, EMAIL_AUTH_OWNED_FIELDS, canonicalEmailAuthData, parseEmailAuthObservation, prepareEmailAuthChange, prepareEmailAuthRollback, serializeEmailAuthChange } from "./email-auth-change-plan.ts";

// Exact nonsecret whitelisted 2026-10-09 observation; never an Auth/provider grant.
const captured = {
  "contract": "wd-email-auth-observation-local-v1",
  "project": "zpvqxtklvjitofpbddrn",
  "observedAt": "2026-10-09T07:34:45.908Z",
  "owned": {
    "mailer_otp_length": {
      "present": true,
      "value": 8
    },
    "mailer_otp_exp": {
      "present": true,
      "value": 3600
    },
    "smtp_host": {
      "present": true,
      "value": null
    },
    "smtp_port": {
      "present": true,
      "value": null
    },
    "smtp_user": {
      "present": true,
      "value": null
    },
    "smtp_admin_email": {
      "present": true,
      "value": null
    },
    "smtp_sender_name": {
      "present": true,
      "value": null
    },
    "mailer_subjects_confirmation": {
      "present": true,
      "value": "Confirm your email address"
    },
    "mailer_subjects_magic_link": {
      "present": true,
      "value": "Your sign-in link"
    },
    "mailer_templates_confirmation_content": {
      "present": true,
      "value": "<h2>Confirm your email address</h2>\n\n<p>Follow the link below to confirm this email address and finish signing up.</p>\n<p><a href=\"{{ .ConfirmationURL }}\">Confirm email address</a></p>"
    },
    "mailer_templates_magic_link_content": {
      "present": true,
      "value": "<h2>Your sign-in link</h2>\n\n<p>Follow the link below to sign in. This link expires shortly and can only be used once.</p>\n<p><a href=\"{{ .ConfirmationURL }}\">Sign in</a></p>"
    }
  },
  "guards": {
    "external_email_enabled": {
      "present": true,
      "value": true
    },
    "mailer_autoconfirm": {
      "present": true,
      "value": false
    },
    "disable_signup": {
      "present": true,
      "value": false
    },
    "external_apple_enabled": {
      "present": true,
      "value": false
    },
    "external_google_enabled": {
      "present": true,
      "value": false
    },
    "mailer_secure_email_change_enabled": {
      "present": true,
      "value": true
    },
    "mailer_allow_unverified_email_sign_ins": {
      "present": true,
      "value": false
    },
    "hook_send_email_enabled": {
      "present": true,
      "value": false
    },
    "smtp_max_frequency": {
      "present": true,
      "value": 60
    },
    "rate_limit_email_sent": {
      "present": true,
      "value": 2
    },
    "rate_limit_otp": {
      "present": true,
      "value": 30
    },
    "security_captcha_enabled": {
      "present": true,
      "value": false
    },
    "site_url": {
      "present": true,
      "value": "http://localhost:3000"
    },
    "uri_allow_list": {
      "present": true,
      "value": ""
    }
  },
  "templateHashes": {
    "confirmation": "c495b24123d38e4bc4295f06afe92a3c11e6ce00df09d81e2cb0706e3d7c79d8",
    "magic_link": "87cf15e18260bceffbcebbe235e1ef1cf1677442199bdf301d9d2e46f1db6782",
    "recovery": "f452789e6dc74df5d977839e9bff203a03c3477d56f29a851672de8c6fedda21",
    "email_change": "97e835167b950082d0cfb9afccb96cb113594a23bd27512b4b83c5f4ed660d6e",
    "invite": "47b91ce3e764fb8d4ea8c49fa5950a4a351a51e9f92802372ca6c874052cabd2",
    "reauthentication": "e31f927b015204c4e371b6fb8b800a97c03fee751304990ee811f785f79ebd32"
  },
  "unownedMailHashes": {
    "recovery": {
      "template": "f452789e6dc74df5d977839e9bff203a03c3477d56f29a851672de8c6fedda21",
      "subject": "1661c9788370435b89092c4603789715186682fcc8f9c4c526ba90bfc7db8d12"
    },
    "email_change": {
      "template": "97e835167b950082d0cfb9afccb96cb113594a23bd27512b4b83c5f4ed660d6e",
      "subject": "28aeb89abc1df14352d8f0361b93e1197603725dd7f0fb92a3780ee7fdfe0be0"
    },
    "invite": {
      "template": "47b91ce3e764fb8d4ea8c49fa5950a4a351a51e9f92802372ca6c874052cabd2",
      "subject": "09f60164a2597b9265ea57f1dfac997d6c3d369972e8be14287b7003e33543cd"
    },
    "reauthentication": {
      "template": "e31f927b015204c4e371b6fb8b800a97c03fee751304990ee811f785f79ebd32",
      "subject": "744a98011c73da1278e8065df9231d96d7a95e7ba51366b87c71a3693fa34429"
    }
  },
  "smtpPasswordState": "null"
};
const before = () => structuredClone(captured);
const sources = () => ({ ...EMAIL_AUTH_SOURCE_PINS });
const make = () => prepareEmailAuthChange(before(), sources());
const held = (fn: () => unknown, code?: string) => { if (code) assert.throws(fn, { message: code }); else assert.throws(fn); };

test("exact observed package covers first signup and repeat login with six digits and preserved guards", () => {
  const original = before(), p = prepareEmailAuthChange(original, sources());
  assert.equal(p.state, "PREPARED_HELD"); assert.equal(p.dispatchAuthority, "NONE"); assert.equal(p.proofLevel, "LOCAL");
  assert.deepEqual(Object.keys(p.fields), [...EMAIL_AUTH_OWNED_FIELDS]);
  assert.equal(p.fields.mailer_otp_length, 6); assert.equal(p.fields.mailer_otp_exp, 600);
  assert.equal(p.fields.smtp_host, "smtp.resend.com"); assert.equal(p.fields.smtp_port, "465"); assert.equal(p.fields.smtp_user, "resend");
  assert.equal(p.fields.smtp_admin_email, "no-reply@mail.wisedinner.com");
  for (const name of ["confirmation", "magic_link"]) {
    const template = p.fields["mailer_templates_" + name + "_content"];
    assert.equal(typeof template, "string"); assert.match(String(template), /\{\{ \.Token \}\}/);
    assert.doesNotMatch(String(template), /ConfirmationURL/);
  }
  assert.deepEqual(p.before, original); assert.deepEqual(p.expectedNonsecretAfter.guards, original.guards);
  assert.deepEqual(p.expectedNonsecretAfter.unownedMailHashes, original.unownedMailHashes);
  assert.equal(p.expectedNonsecretAfter.smtpPasswordState, "present-unverified");
  assert.ok(p.holds.includes("mixed-version-and-in-flight-code-transition")); assert.ok(p.holds.includes("resend-enforced-domain-tls-before-send"));
  assert.equal(Object.hasOwn(p.fields, "smtp_pass"), false);
  assert.equal(p.smtpPassword.reference.kind, "existing-private-credential-reference");
  assert.equal(Object.isFrozen(p.fields), true); assert.equal(Object.isFrozen(p.before.owned), true);
});
test("complete deterministic operation body and canonical serialization are reproducible", () => {
  const a = make(), b = make();
  assert.equal(a.operationId, b.operationId); assert.equal(serializeEmailAuthChange(a), serializeEmailAuthChange(b));
  assert.deepEqual(parseEmailAuthObservation(canonicalEmailAuthData(before())), before());
  const input = before(); const p = prepareEmailAuthChange(input, sources()); input.owned.mailer_otp_length.value = 9;
  assert.equal(p.before.owned.mailer_otp_length?.present && p.before.owned.mailer_otp_length.value, 8);
});
test("held rollback restores exact owned nulls and templates, with unchanged others", () => {
  const p = make(), after = structuredClone(p.expectedNonsecretAfter); after.observedAt = "2026-10-09T08:00:00.000Z";
  const rollback = prepareEmailAuthRollback(before(), sources(), after, "known-nonsecret-after");
  assert.equal(rollback.state, "PREPARED_HELD");
  assert.ok("fields" in rollback);
  if (!("fields" in rollback)) throw Error("missing rollback candidate");
  for (const k of EMAIL_AUTH_OWNED_FIELDS) {
    const original = p.before.owned[k]; assert.ok(original?.present);
    if (!original?.present) throw Error("missing before field");
    assert.equal(rollback.fields[k], original.value);
  }
  assert.equal(rollback.smtpPassword.restoreState, "null");
  assert.equal(rollback.dispatchAuthority, "NONE"); assert.equal(Object.hasOwn(rollback.fields, "smtp_pass"), false);
});
test("unknown outcome produces a hold without a replay or rollback body", () => {
  assert.deepEqual(prepareEmailAuthRollback(before(), sources(), null, "unknown"), {state:"HELD",reason:"unknown-outcome-no-replay",dispatchAuthority:"NONE"});
});
test("mixed eight-digit in-flight / six-digit after state and partial application are held", () => {
  const p = make(), after = structuredClone(p.expectedNonsecretAfter);
  after.owned.mailer_otp_length = {present:true,value:8};
  held(() => prepareEmailAuthRollback(before(), sources(), after, "known-nonsecret-after"), "after_drift");
});
test("another actor's owned or shared template/rate change cannot be overwritten", () => {
  const p = make();
  for (const mutation of [(v: typeof p.expectedNonsecretAfter) => { v.owned.smtp_sender_name = {present:true,value:"Other"}; },
    (v: typeof p.expectedNonsecretAfter) => { v.guards.rate_limit_email_sent = {present:true,value:5}; },
    (v: typeof p.expectedNonsecretAfter) => { const h = v.unownedMailHashes.recovery; if(h) h.subject = "0".repeat(64); }]) {
    const after = structuredClone(p.expectedNonsecretAfter); mutation(after);
    held(() => prepareEmailAuthRollback(before(), sources(), after, "known-nonsecret-after"), "after_drift");
  }
});
test("current source and exact observed target/contract are required, never caller grant flags", () => {
  held(() => prepareEmailAuthChange(before(), {...sources(), nativeSdk:"0".repeat(64)}), "source_drift");
  held(() => prepareEmailAuthChange({...before(), project:"otherproject"}, sources()), "target_or_contract");
  held(() => prepareEmailAuthChange({...before(), contract:"future-v2"}, sources()), "target_or_contract");
  held(() => prepareEmailAuthChange({...before(), approved:true}, sources()), "field_shape");
});
test("missing, null and empty SMTP/subject/template values are not interchanged", () => {
  for (const slot of [{present:false}, {present:true,value:""}]) {
    const v = before(); Object.assign(v.owned.smtp_host, slot);
    if(!slot.present) Reflect.deleteProperty(v.owned.smtp_host, "value");
    held(() => prepareEmailAuthChange(v, sources()), "before_drift");
  }
  const v = before(); Reflect.deleteProperty(v.owned,"mailer_templates_confirmation_content");
  held(() => prepareEmailAuthChange(v, sources()), "field_shape");
  const nullBody = before(); Object.assign(nullBody.owned.mailer_templates_magic_link_content, {value:null});
  held(() => prepareEmailAuthChange(nullBody, sources()), "template_correspondence");
});
test("template content must agree with its actual digest and full before binding", () => {
  const v = before(); v.owned.mailer_templates_confirmation_content.value += "<p>changed</p>";
  held(() => prepareEmailAuthChange(v, sources()), "template_correspondence");
  const changed = before(); changed.owned.mailer_subjects_magic_link.value = "changed";
  held(() => prepareEmailAuthChange(changed, sources()), "before_drift");
});
test("changed secret state and secret values are refused without echoing them", () => {
  const v = before(); Object.assign(v,{smtpPasswordState:"present-unverified"});
  held(() => prepareEmailAuthChange(v, sources()), "before_drift");
  const secret = "synthetic-secret-do-not-echo";
  try { prepareEmailAuthChange({...before(), smtp_pass:secret}, sources()); assert.fail("accepted secret"); }
  catch(error) { assert.ok(error instanceof Error); assert.equal(error.message,"field_shape"); assert.doesNotMatch(error.message, /synthetic-secret/); }
  const serialized = serializeEmailAuthChange(make());
  assert.doesNotMatch(serialized, /synthetic-secret|Authorization|Bearer /);
});
test("getter, prototype, unknown nested field, symbol and sparse arrays fail before execution", () => {
  let gets = 0; const v = before();
  Object.defineProperty(v,"project",{enumerable:true,get(){gets++;return captured.project;}});
  held(() => prepareEmailAuthChange(v,sources()), "descriptor_shape"); assert.equal(gets,0);
  held(() => prepareEmailAuthChange(Object.assign(Object.create({}),before()),sources()), "prototype_shape");
  held(() => prepareEmailAuthChange({...before(), owned:{...before().owned,extra:{present:true,value:1}}},sources()), "field_shape");
  held(() => canonicalEmailAuthData({[Symbol("secret")]:1}), "field_shape");
  held(() => canonicalEmailAuthData(Array(2)), "array_shape");
});
test("canonical parser refuses duplicate keys, invalid JSON, excessive depth/size and nonfinite values", () => {
  const bytes = canonicalEmailAuthData(before());
  held(() => parseEmailAuthObservation(" "+bytes), "noncanonical_json");
  held(() => parseEmailAuthObservation(bytes.replace('"project":', '"project":"other","project":')), "noncanonical_json");
  held(() => parseEmailAuthObservation("{"), "json_shape");
  held(() => parseEmailAuthObservation("x".repeat(131073)), "payload_bound");
  let deep: object = {}; for(let i=0;i<10;i++) deep={deep};
  held(() => canonicalEmailAuthData(deep), "shape_bound");
  held(() => canonicalEmailAuthData({bad:NaN}), "number_shape");
});
test("changed serialized plan/body/key, extra field or getter cannot masquerade as original", () => {
  const p=make();
  held(() => serializeEmailAuthChange({...p,operationId:"0".repeat(64)}), "plan_drift");
  held(() => serializeEmailAuthChange({...p,fields:{...p.fields,mailer_otp_length:8}}), "plan_drift");
  const v={...p}; let gets=0; Object.defineProperty(v,"before",{enumerable:true,get(){gets++;return p.before;}});
  held(() => serializeEmailAuthChange(v), "descriptor_shape"); assert.equal(gets,0);
});
