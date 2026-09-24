-- BACKEND-V1 §1. applied with `npx supabase db push`. RLS on every table, no public policies:
-- server routes and the pipeline use the service role key only (it bypasses RLS).
-- text ids for stores / skus / recipes (readable in the snapshot and the app); uuid for event rows.

create table if not exists stores (
  id text primary key,
  chain text not null,
  banner text not null,
  region_scope text not null default 'national',
  price_index numeric not null default 1.0,
  data_source text not null default 'index',
  created_at timestamptz not null default now()
);

create table if not exists skus (
  id text primary key,
  name text not null,
  aisle text not null check (aisle in ('produce', 'meat', 'dairy', 'bakery', 'frozen', 'pantry')),
  perishable boolean not null default false,
  pack_qty numeric not null,
  pack_unit text not null,
  canonical_unit text not null check (canonical_unit in ('g', 'ml', 'each')),
  grams_per_unit numeric not null,
  diet_flags text[] not null default '{}',
  baseline_price numeric,          -- internal: national baseline shelf price used by the index estimate
  kroger_product_id text,
  walmart_item_id text,
  usda_fdc_id text,
  created_at timestamptz not null default now()
);

create table if not exists prices (
  id uuid primary key default gen_random_uuid(),
  sku_id text not null references skus (id) on delete cascade,
  store_id text not null references stores (id) on delete cascade,
  region text not null default 'national',
  shelf_price numeric not null,
  unit_price numeric,
  source text not null check (source in ('kroger-api', 'walmart-api', 'instacart-cart', 'index-estimate', 'receipt')),
  confidence numeric not null default 0.5,
  as_of date not null default current_date,
  created_at timestamptz not null default now(),
  unique (sku_id, store_id, region, source)
);
create index if not exists prices_sku_store on prices (sku_id, store_id);

-- best available source per (sku, store): receipt > kroger-api > walmart-api > instacart-cart > index-estimate,
-- newest first inside a source. security_invoker so the view never bypasses the tables' RLS.
create or replace view store_prices with (security_invoker = true) as
select distinct on (sku_id, store_id)
  sku_id, store_id, region, shelf_price, unit_price, source, confidence, as_of
from prices
order by sku_id, store_id,
  case source
    when 'receipt' then 0
    when 'kroger-api' then 1
    when 'walmart-api' then 2
    when 'instacart-cart' then 3
    else 4
  end,
  as_of desc;

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  user_hash text not null,
  store_id text not null references stores (id),
  region text not null,
  sku_id text not null references skus (id),
  price numeric not null,
  observed_at timestamptz not null default now(),
  verified boolean not null default false
);
create index if not exists receipts_sku_store on receipts (sku_id, store_id);

create table if not exists nutrition (
  sku_id text primary key references skus (id) on delete cascade,
  protein_g numeric not null,
  kcal numeric not null,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  per text not null default '100g'
);

create table if not exists recipes (
  id text primary key,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  tags text[] not null default '{}',
  servings int not null default 1,
  minutes int not null default 20,
  steps text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  recipe_id text not null references recipes (id) on delete cascade,
  sku_id text not null references skus (id),
  qty numeric not null,
  unit text not null,
  primary key (recipe_id, sku_id)
);

create table if not exists recipe_variants (
  recipe_id text not null references recipes (id) on delete cascade,
  variant_recipe_id text not null references recipes (id) on delete cascade,
  kind text not null check (kind in ('protein_swap', 'carb_swap', 'veg_swap')),
  primary key (recipe_id, variant_recipe_id)
);

create table if not exists delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  list_hash text not null,
  store_id text not null references stores (id),
  zip text not null,
  subtotal numeric not null,
  fees numeric not null,
  source text not null default 'instacart-cart',
  quoted_at timestamptz not null default now()
);

create table if not exists data_snapshots (
  version int primary key,
  url text not null,
  sha256 text not null,
  created_at timestamptz not null default now()
);

create table if not exists shared_weeks (
  id text primary key,
  budget numeric not null,
  protein_target numeric not null,
  diet text not null default 'none',
  household int not null default 1,
  stores text[] not null default '{}',
  week jsonb not null,
  created_at timestamptz not null default now()
);

alter table stores enable row level security;
alter table skus enable row level security;
alter table prices enable row level security;
alter table receipts enable row level security;
alter table nutrition enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_variants enable row level security;
alter table delivery_quotes enable row level security;
alter table data_snapshots enable row level security;
alter table shared_weeks enable row level security;
-- no public policies on purpose.

-- store seed (docs/STORE-INDEX.md carries the sources for price_index; 1.00 = the national baseline).
insert into stores (id, chain, banner, region_scope, price_index, data_source) values
  ('walmart',       'Walmart',      'Walmart',                'national',            0.90, 'index'),
  ('kroger',        'Kroger',       'Kroger',                 'midwest-south',       1.00, 'kroger-api'),
  ('ralphs',        'Kroger',       'Ralphs',                 'southern-california', 1.00, 'kroger-api'),
  ('fred-meyer',    'Kroger',       'Fred Meyer',             'pacific-northwest',   1.00, 'kroger-api'),
  ('qfc',           'Kroger',       'QFC',                    'pacific-northwest',   1.00, 'kroger-api'),
  ('king-soopers',  'Kroger',       'King Soopers',           'colorado',            1.00, 'kroger-api'),
  ('frys',          'Kroger',       'Fry''s',                 'arizona',             1.00, 'kroger-api'),
  ('smiths',        'Kroger',       'Smith''s',               'mountain-west',       1.00, 'kroger-api'),
  ('harris-teeter', 'Kroger',       'Harris Teeter',          'southeast',           1.05, 'kroger-api'),
  ('dillons',       'Kroger',       'Dillons',                'kansas',              1.00, 'kroger-api'),
  ('food-4-less',   'Kroger',       'Food 4 Less',            'california-midwest',  0.92, 'kroger-api'),
  ('marianos',      'Kroger',       'Mariano''s',             'chicago',             1.05, 'kroger-api'),
  ('pick-n-save',   'Kroger',       'Pick ''n Save',          'wisconsin',           1.00, 'kroger-api'),
  ('aldi',          'Aldi',         'Aldi',                   'national',            0.85, 'index'),
  ('target',        'Target',       'Target',                 'national',            1.03, 'index'),
  ('publix',        'Publix',       'Publix',                 'southeast',           1.23, 'index'),
  ('costco',        'Costco',       'Costco',                 'national',            0.88, 'index'),
  ('heb',           'H-E-B',        'H-E-B',                  'texas',               0.92, 'index'),
  ('trader-joes',   'Trader Joe''s','Trader Joe''s',          'national',            0.95, 'index'),
  ('whole-foods',   'Whole Foods',  'Whole Foods Market',     'national',            1.28, 'index'),
  ('safeway',       'Albertsons',   'Safeway',                'west',                1.12, 'index'),
  ('albertsons',    'Albertsons',   'Albertsons',             'west-mountain',       1.12, 'index'),
  ('meijer',        'Meijer',       'Meijer',                 'midwest',             1.00, 'index'),
  ('other',         'Other',        'Other store',            'national',            1.00, 'index')
on conflict (id) do update set chain = excluded.chain, banner = excluded.banner,
  region_scope = excluded.region_scope, price_index = excluded.price_index, data_source = excluded.data_source;
