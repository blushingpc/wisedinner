import source from "./source.ts";
import reviews from "./reviews.ts";
import {safeCopy,freeze} from "./model.ts";
import {assertSourceCorrespondence} from "./source-correspondence.ts";
import {validateSnapshot} from "./core/snapshot.ts";
import {projectPurchased} from "./quantity.ts";
export function stageNative(){assertSourceCorrespondence(source);if(JSON.stringify(reviews)!==JSON.stringify(source.reviews))throw Error("reviewed_native_review_held");const edible=freeze(validateSnapshot(safeCopy(source.edible))),basket=freeze(reviews);return {edible,basket,purchased:projectPurchased(edible,basket.quantities)};}
export function assertSources(){assertSourceCorrespondence(source);}
