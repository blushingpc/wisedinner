import {createNativeInventory} from "./inventory.ts";
import {createNativeReroll} from "./reroll.ts";
// Data computation only. No owner/access authority, storage, transport or runtime activation.
export function createNativeReviewedOwnerProducer(){const inventory=createNativeInventory(),reroll=createNativeReroll();return Object.freeze({install:inventory.install,replace:reroll.replace});}
