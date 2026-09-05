# Data-viz palette — the WiseDinner instance of the bundled `dataviz` skill

The `dataviz` skill ships with Claude Code (bundled, official, always on). Its method is
design-system-agnostic; this file is the "swap `references/palette.md` for your brand" step,
kept in the repo because the bundled copy is regenerated on every Claude Code update.
Validated 2026-09-05 with the skill's own `scripts/validate_palette.js` on the paper surface.

## Roles (founder law 2026-09-05: kale for the primary series, ink for axes)

| Role | Token | Hex | Note |
|---|---|---|---|
| surface (light) | paper `--color-bg` | `#fbfaf6` | every chart on the site |
| axes, ticks, gridlines | ink `--color-ink` / rule `--color-rule` | `#191817` / `#e6e0d3` | axes ink at 1px, grid rule, both recessive |
| text (values, labels, legend) | ink / ink-soft | `#191817` / `#4e4b45` | text wears text tokens, never the series colour |
| **single series** | kale `--color-kale` | `#173f2e` | one measure, no legend — 10.6:1 on paper; the validator's categorical checks do not apply to a lone series |
| headline / hero number | ink, mono `tabular-nums` | `#191817` | receipt discipline: money keeps its "est." label |
| status: serious | tomato `--color-tomato` | `#c8402b` | reserved, ships with icon + label |
| status: warning | yolk-press | `#e6ad00` | reserved |

## Categorical order (≥ 2 series) — validated, cap 3

Real kale (`#173f2e`, OKLCH C 0.055) FAILS the skill's chroma floor (C ≥ 0.10 — "reads as gray") as a
categorical slot, so multi-series charts use the nearest passing step of kale's hue:

| Slot | Name | Light (paper) | Rule |
|---|---|---|---|
| 1 | kale-viz | `#1d8a4f` | primary; same hue family as kale |
| 2 | yolk-viz | `#c98500` | contrast 2.94:1 on paper → **relief rule**: direct labels or a table view, always |
| 3 | tomato | `#c8402b` | |

`node scripts/validate_palette.js "#1d8a4f,#c98500,#c8402b" --mode light --surface "#fbfaf6"` → ALL CHECKS PASS
with two WARNs that become rules: slot 1↔2 protan ΔE 7.0 sits in the 6–8 band, so ≥ 2-series charts ALWAYS carry
secondary encoding (direct labels + the 2px surface gap between fills); slot 2 needs the relief rule above.
A fourth series folds into "Other" or facets — no tested fourth slot passes beside these three.

## Not yet validated
- Dark surface (the kale room `#173f2e`): no chart lives there today; validate a dark set before placing one.
- Sequential ramp: kale, light→dark, single hue — check lightness monotonicity when first used.
