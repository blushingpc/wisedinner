import raw from "./menu.json" with { type: "json" };

// meal library v2 (REDESIGN-V3 §2H): restaurant-familiar comfort dishes rebuilt to hit protein, named like the
// menu item. protein and cost are per-serving estimates (estimate: true) — the solver templates for these dishes
// are the data sprint's job, not this one.
export type MenuItem = {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner";
  protein_source: string;
  protein_g: number;
  cost_usd: number;
  estimate: true;
  img: string; // /img/menu/<id>.jpg — 1:1, generated per §2I
};

export const menu: MenuItem[] = raw as MenuItem[];
export const menuById = Object.fromEntries(menu.map((m) => [m.id, m])) as Record<string, MenuItem>;
