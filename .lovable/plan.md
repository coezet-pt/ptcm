
I checked the current code, and the loop in `src/lib/sim/choiceModel.ts` is already using the new formula path for all five factors:

- `TCO`: `ELASTICITIES.TCO * GLOBAL_MULTIPLIER * (diesel/pt - 1)`
- `vehiclePrice`: `ELASTICITIES.vehiclePrice * GLOBAL_MULTIPLIER * (diesel/pt - 1)`
- `ratedPayload`: `ELASTICITIES.ratedPayload * GLOBAL_MULTIPLIER * (pt/diesel - 1)` via `payloadRatio(...)`
- `tatGradeability`: `ELASTICITIES.tatGradeability * GLOBAL_MULTIPLIER * (pt/diesel - 1)`
- `rangeFillingTime`: `ELASTICITIES.rangeFillingTime * GLOBAL_MULTIPLIER * (diesel/pt - 1)`

It also:
- sums the five factor values instead of multiplying them
- no longer imports or reads `CHOICE_FACTORS` or `CHOICE_WEIGHT_DENOMINATOR`
- only leaves those old constants in `src/lib/constants/extracted.ts`, unused by `choiceModel.ts`

So the “old formula still in the loop” is not what’s in the current file snapshot. The missing piece is the runtime assertion you requested, which has not been added yet, and I can’t run the app in read-only mode.

Plan:
1. Add a first-run runtime check inside the actual `computeShares` bucket/powertrain loop in `src/lib/sim/choiceModel.ts`.
   - Store per-factor values for the current powertrain before summing.
   - On `bucket.id === 'B1'`, `targetYear === 2045`, first debug pass only, log:
     - BET TCO factor
     - expected note (`~7.186`)
     - hard error if value is `> 100`
2. Keep the existing module self-test, but make the runtime loop assertion the primary source of truth.
3. Optionally expand the debug block to print the full factor breakdown for `B1`/`BET` and `B1`/`CNG` so we can distinguish:
   - wrong factor values
   - wrong normalization
   - wrong downstream mutation
4. Run with `window.__SIM_DEBUG__ = true` and inspect:
   - the new `🧪 RUNTIME CHECK` line
   - Layer 1 shares
   - B1 factor breakdown
5. Based on that output:
   - If BET TCO factor is ~7.186, the bug is elsewhere after factor computation.
   - If it is ~6400, then the running bundle is still using stale/old logic and we should inspect build/cache/module path issues next.

Files to update once approved:
- `src/lib/sim/choiceModel.ts`

Technical note:
From the code I inspected, there is no evidence that the loop still references old weighting-based constants. That means the next implementation step should focus on adding runtime instrumentation rather than redoing the formula rewrite.
