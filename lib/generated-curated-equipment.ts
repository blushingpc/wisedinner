// Exact tools present in the pinned curated family. No generic cookware inference.
export const CURATED_EQUIPMENT_POLICY="wd-curated-exact-tools-v1";
export const CURATED_HEATED_TOOLS=Object.freeze(["pot","skillet","nonstick skillet","small saucepan","steamer"]);
export const CURATED_HAND_TOOLS=Object.freeze(["colander","cutting board","grater","knife","lid","lined baking tray","mixing bowl","serving dish","shallow bowl","small baking dish","spatula","thermometer","tray","two forks","two lined baking trays","two mixing bowls"]);
export function classifyCuratedMealTool(source:string):readonly {source:string;role:"declared-appliance"|"informational-prerequisite"|"cold-storage-prerequisite"|"unclassified";applianceId?:string}[]{
 if(source==="refrigerator")return [{source,role:"cold-storage-prerequisite"}];
 if(CURATED_HEATED_TOOLS.includes(source))return [{source,role:"declared-appliance",applianceId:"stove"}];
 if(["stove","oven","toaster"].includes(source))return [{source,role:"declared-appliance",applianceId:source}];
 return [{source,role:CURATED_HAND_TOOLS.includes(source)?"informational-prerequisite":"unclassified"}];
}
export function curatedEquipmentSatisfied(tools:readonly string[],available:readonly string[]):boolean{
 return tools.every(source=>available.includes(source)&&classifyCuratedMealTool(source).every(t=>t.role!=="unclassified"&&(t.role!=="declared-appliance"||available.includes(t.applianceId!))));
}
export function curatedEquipmentDescriptor(){return {policy:CURATED_EQUIPMENT_POLICY,heatedTools:CURATED_HEATED_TOOLS,handTools:CURATED_HAND_TOOLS};}
