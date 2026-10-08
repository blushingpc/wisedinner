// Separate preparation family. Never an Answers, v2 plan, receipt or access grant.
export const EQUIPMENT_FAMILY = "wd-owner-equipment-profile";
export const EQUIPMENT_VERSION = 1;
export const EQUIPMENT_REGISTRY = "917a703327aef561278fd1cd6d12580d2789ec7c01893395b9e538ad67562678";
export const EQUIPMENT_IDS = Object.freeze(["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "toaster", "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools", "blender", "tongs", "clean-serving-plate", "raw-poultry-board", "can-opener", "saucepan-lid", "oven", "sheet-pan", "oven-mitts", "fork", "raw-seafood-board", "raw-meat-board", "nonstick-oven-safe-sheet-pan"]);
export type EquipmentProfile = Readonly<{ family: typeof EQUIPMENT_FAMILY; version: 1; registry: string; owner: string; planningRevision: number; profileRevision: number; equipment: readonly string[] | null }>;
function refuse(): never { throw Error("equipment_invalid"); }
export function equipmentIds(value: unknown): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) refuse();
  const objectValue: object = value;
  const fields = Object.getOwnPropertyDescriptors(objectValue), n: unknown = fields.length?.value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > EQUIPMENT_IDS.length || Reflect.ownKeys(fields).length !== n + 1) refuse();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = fields[String(i)];
    if (!d || !("value" in d) || !d.enumerable || typeof d.value !== "string" || !EQUIPMENT_IDS.includes(d.value) || out.includes(d.value)) refuse();
    out.push(d.value);
  }
  return EQUIPMENT_IDS.filter(id => out.includes(id));
}
export function equipmentProfile(value: unknown): EquipmentProfile {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) refuse();
  const d = Object.getOwnPropertyDescriptors(value), keys = ["family", "version", "registry", "owner", "planningRevision", "profileRevision", "equipment"];
  if (Reflect.ownKeys(d).length !== keys.length || Reflect.ownKeys(d).some(k => typeof k !== "string" || !keys.includes(k))) refuse();
  const v: Record<string, unknown> = {};
  for (const k of keys) { const f = d[k]; if (!f || !("value" in f) || !f.enumerable) refuse(); v[k] = f.value; }
  if (v.family !== EQUIPMENT_FAMILY || v.version !== 1 || v.registry !== EQUIPMENT_REGISTRY || typeof v.owner !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.owner)) refuse();
  const plan = v.planningRevision, profile = v.profileRevision;
  if (typeof plan !== "number" || !Number.isSafeInteger(plan) || plan < 0 || typeof profile !== "number" || !Number.isSafeInteger(profile) || profile < 1) refuse();
  const equipment = equipmentIds(v.equipment);
  return Object.freeze({ family: EQUIPMENT_FAMILY, version: 1, registry: EQUIPMENT_REGISTRY, owner: v.owner, planningRevision: plan, profileRevision: profile, equipment: equipment === null ? null : Object.freeze(equipment) });
}
export const encodeEquipmentProfile = (value: unknown): string => JSON.stringify(equipmentProfile(value));
export function decodeEquipmentProfile(raw: string): EquipmentProfile {
  if (typeof raw !== "string" || raw.length > 4096) refuse();
  let value: unknown; try { value = JSON.parse(raw); } catch { return refuse(); }
  const profile = equipmentProfile(value);
  // Exact writer representation refuses duplicate JSON keys and lossy normalization.
  if (encodeEquipmentProfile(profile) !== raw) refuse();
  return profile;
}
