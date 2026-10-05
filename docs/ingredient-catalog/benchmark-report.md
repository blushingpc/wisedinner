# Deterministic scaling evidence

October 4 local session. Node v24.17.0, Windows 10.0.26200, Intel Core i5-14400F, 16 logical CPUs, about 16 GB RAM. Shared desktop, warm sequential runs. Every reported case was repeated and its full output digest compared. This is not iPhone performance evidence.

| Dataset | Profile/seed cases feasible | Median solve or selection plus solve | Range | Substitute slots with candidates |
|---|---|---|---|---|
| 83 legacy draft recipes | 18/18 | 529 ms | 252 to 1,520 ms | See baseline JSON |
| 149 mixed legacy plus reviewed additions | 18/18 | 660 ms | 338 to 910 ms | 37/54 |
| 500 synthetic stress entries | 18/18 | 692 ms | 264 to 2,905 ms | 22/54 |
| 1,000 synthetic stress entries | 18/18 | 654 ms | 291 to 2,142 ms | 25/54 |
| 4,787 synthetic stress entries | 18/18 | 745 ms | 302 to 1,315 ms | 41/54 |

Six acceptance profiles, seeds 0, 7 and 19. Baseline has 21 cases, scaling 85: three difficult cases per dataset plus an approved-only subset probe. Below-floor budget, extreme protein at the floor and conflicting calorie/protein targets remain honestly infeasible. Large difficult cases take about 4 to 4.8 seconds despite the cap, so UI responsiveness needs device measurement. Sampled process RSS reached about 375 MB; that includes draft generation/compilation and accumulated benchmark work, not isolated peak solver memory. Candidate generation in the final staging run took about 33 ms; detailed validation timing is in expansion-report.json.

No optimization changed the shared solver core. The new offline seam shortlists at most 96 recipes before annealing, polishing, pair repair or substitution. Thus a pair-repair day has at most 3 times 96 squared candidate pairs; the existing five days and bounded recovery remain. Full catalog ranking is O(N log N), with no full-catalog pair search. Existing catalogs of 96 or fewer take the exact original path. Tests prove identical small-catalog outputs, deterministic shortlisting, family-parent retention and six-profile hard-constraint evaluation.

Scaling strategy explicitly retains the 83 legacy IDs as anchors and fills up to 96 by deterministic cost, protein efficiency, protein and seeded-variety ordering. This preserves continuity, not global optimality. Substitute coverage is non-monotonic: extra depth and a bounded shortlist can change the week and reduce available alternatives. No promise of cheaper or more substitutable weeks follows from these numbers. The default no-anchor strategy is structurally bounded but does not have the same broad feasibility evidence; the later app integration must choose and test its shortlist policy.

Critical data limit: legacy recipes still reference unresolved nutrition/packages. Larger computational sets include quarantined drafts and are synthetic stress, never catalog approvals. Only 66 preparations pass current internal source/metadata gates. Their standalone ten-SKU subset is infeasible for the typical profile (only nine items selected versus the twelve-item floor, protein and calorie-share issues). No constraint was relaxed to hide that limit. Do not publish the subset or describe the benchmark as complete nutrition validation.

Raw evidence: benchmark-baseline.json, benchmark-scaling.json and expansion-report.json. Later device checks: cold/warm solve and substitution timings, sampled and peak memory, UI responsiveness/background scheduling, all restrictions across initial/repaired/regenerated/paid selection paths, deterministic parity and low-memory recovery on a real iPhone. Public/API/app connection is still separate work.
