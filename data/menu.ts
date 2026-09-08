import raw from "./menu.json" with { type: "json" };

// menu v3 (REDESIGN-V4 §4): meals a fit person actually eats and would order. authored in scripts/gen-fixtures.ts,
// which writes this JSON and both fixture weeks. protein and cost are per-serving estimates (estimate: true); the
// solver templates for these dishes are the data sprint's job, not this one.
export type MenuItem = {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner";
  protein_source: string;
  protein_g: number;
  cost_usd: number;
  estimate: true;
  img: string; // /img/menu/<id>.jpg, 1:1, generated per REDESIGN-V4 §5
};

export const menu: MenuItem[] = raw as MenuItem[];
export const menuById = Object.fromEntries(menu.map((m) => [m.id, m])) as Record<string, MenuItem>;
