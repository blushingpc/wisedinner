# Store price index

`stores.price_index` scales a national baseline shelf price to a store when no live price exists for that
(sku, store). Live sources (Kroger API today; Walmart, Instacart and receipts later) always win over the index
(see the `store_prices` view precedence). Index rows are written with `source = index-estimate`,
`confidence = 0.3`, and are never shown as anything but an estimate.

## Baseline

1.00 = the national baseline. It is anchored on the Kroger family because that is the live feed: for every SKU
the baseline is the median Kroger-family shelf price across the five pipeline regions (Columbus 43215,
Los Angeles 90012, Houston 77002, Atlanta 30303, Seattle 98101) divided by Kroger's own index (1.00). SKUs with no
live price fall back to `skus.baseline_price` (the hand-estimated 2026-08-30 table with its 10% buffer removed).

## Values

| store | index | basis |
|---|---|---|
| Walmart | 0.90 | 109-item comparable basket, Northern Indiana, 2026: Walmart $279.73 vs Kroger $311.34 (0.898) [1] |
| Kroger family (Kroger, Ralphs, Fred Meyer, QFC, King Soopers, Fry's, Smith's, Dillons, Pick 'n Save) | 1.00 | the live anchor; one index for the family, live rows per banner |
| Harris Teeter, Mariano's | 1.05 | Kroger upscale banners; editorial +5% over the family until live rows exist |
| Food 4 Less | 0.92 | Kroger warehouse banner; editorial, between Walmart and Kroger until live rows exist |
| Aldi | 0.85 | same basket: Aldi $263.62 vs Kroger $311.34 (0.847) [1]; cheapest on 125 of 184 items |
| Costco | 0.88 | 8-item staples basket mid-2026: Costco $18.30 vs Kroger $23.59 (0.78) [2], lifted to 0.88 because club packs are larger than the SKU packs the solver buys and the $65 membership is not in the shelf price |
| Meijer | 1.00 | same basket as [1]: Meijer $313.26 vs Kroger $311.34 (1.006) |
| Target | 1.03 | Target ≈ Walmart +14% on an overlapping basket (analyst basket, holiday 2021 and 2026 follow-ups) [3][4]; 1.14 × 0.90 = 1.03 |
| Publix | 1.23 | Publix ≈ Walmart +37% [3]; 1.37 × 0.90 = 1.23 |
| Whole Foods | 1.28 | Whole Foods ≈ Walmart +42% [3]; 1.42 × 0.90 = 1.28 |
| H-E-B | 0.92 | editorial: dunnhumby RPI 2026 ranks H-E-B first with price as a top driver [5]; no basket in hand, set between Walmart and Kroger |
| Trader Joe's | 0.95 | editorial: private-label chain, RPI top 10 on value [5]; no basket in hand |
| Safeway / Albertsons | 1.12 | editorial: conventional West Coast chains price above Kroger in the baskets we found; no basket in hand |
| Other | 1.00 | unknown store = baseline |

Editorial rows are the ones to replace first when a live source lands (Walmart API) or when receipts accumulate
for that store; the pipeline prefers any live or receipt row over the index automatically.

## Sources

1. Joyfully Thriving, "America's Cheapest Grocery Store" (2026 basket, Northern Indiana, 184 items, 109 directly comparable): https://joyfullythriving.com/cheapest-grocery-store/
2. GroceryTracker Pro, "Grocery Store Price Comparison 2026: Walmart vs Costco vs Aldi vs Kroger" (8-item staples basket, mid-2026): https://grocery-tracker-pro.com/blog/grocery-store-price-comparison/
3. Benzinga, "Which 2 Stores Have The Cheapest Groceries This Holiday Season?" (analyst basket: Target +14%, Sprouts +35%, Publix +37%, Whole Foods +42% vs Walmart): https://www.benzinga.com/analyst-ratings/analyst-color/21/12/24526713/what-2-stores-have-the-cheapest-groceries-this-holiday-season
4. Benzinga, "Grocery Wars: Walmart Maintains Dominance With Lowest Prices, Target Retains #2 Spot": https://benzinga.com/z/36415197
5. dunnhumby, "9th Annual Retailer Preference Index for U.S. Grocery" (2026): https://www.dunnhumby.com/news/ninth-annual-us-grocery-rankings/
