-- store_prices collapsed every region of a store into one row (distinct on sku, store), so a chain with five
-- ZIPs kept one. The key is (sku, store, region); precedence stays receipt > kroger-api > walmart-api >
-- instacart-cart > index-estimate, newest first inside a source. security_invoker as before.
create or replace view store_prices with (security_invoker = true) as
select distinct on (sku_id, store_id, region)
  sku_id, store_id, region, shelf_price, unit_price, source, confidence, as_of
from prices
order by sku_id, store_id, region,
  case source
    when 'receipt' then 0
    when 'kroger-api' then 1
    when 'walmart-api' then 2
    when 'instacart-cart' then 3
    else 4
  end,
  as_of desc;
