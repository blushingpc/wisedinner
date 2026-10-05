import { runAcceptance } from "./reviewed-week-acceptance.ts";
import { overnightApproval, overnightBasket, overnightCandidates } from "./overnight-food.ts";
runAcceptance({output:"data/pipeline/overnight/reviewed",evidence:"docs/ingredient-catalog/overnight-food-acceptance.json",approval:overnightApproval(),basket:overnightBasket(),candidates:overnightCandidates()});
