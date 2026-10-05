import {runAcceptance} from "./reviewed-week-acceptance.ts";
import {overnightBasket} from "./overnight-food.ts";
import {plantApproval,plantCandidates} from "./overnight-plant.ts";
runAcceptance({output:"data/pipeline/overnight/reviewed-plant",evidence:"docs/ingredient-catalog/overnight-plant-acceptance.json",approval:plantApproval(),basket:overnightBasket(),candidates:plantCandidates()});
