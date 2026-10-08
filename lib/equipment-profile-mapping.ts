import { decodeEquipmentProfile, equipmentProfile, encodeEquipmentProfile } from "./equipment-profile-codec.ts";

// Structural candidate only. Correspondence supplied here is never Auth or a server receipt.
export function equipmentMappingCandidate(raw: string, correspondence: unknown) {
  const profile = decodeEquipmentProfile(raw), current = equipmentProfile(correspondence);
  if (encodeEquipmentProfile(current) !== raw || profile.equipment === null) throw Error("equipment_mapping_held");
  return Object.freeze({ family: profile.family, version: profile.version, registry: profile.registry, owner: profile.owner,
    planningRevision: profile.planningRevision, profileRevision: profile.profileRevision,
    ownedEquipment: Object.freeze([...profile.equipment]), productAdmitted: false as const });
}
