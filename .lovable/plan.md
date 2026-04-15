

# Add TCO Breakdown Diagnostic to `tco.ts`

## Problem
TCO values for B1 2045 are wrong (Diesel=41.46 vs Excel 56.94, BET=25.42 vs Excel 49.68). Need to see capex vs opex breakdown to pinpoint whether the bug is in vehicle price, fuel cost, or amortization.

## Changes

### `src/lib/sim/tco.ts`

1. **Expand `TCOResult` interface** to include diagnostic fields:
   - `capexPerKm`, `opexPerKm`, `fuelCostPerKm`, `maintPerKm`, `tollPerKm`, `resalePct`

2. **Store these values** in the `ptResults[pt]` assignment (line 251) — they're already computed as local variables, just need to be included in the return object.

3. **Replace the existing DEBUG block** (lines 256-264) with the detailed diagnostic that logs all intermediate values for B1 2045 when `__SIM_DEBUG__` is set, including the Excel reference values.

### No other files changed
No changes to `choiceModel.ts`, `pttm.ts`, or `stockEmissions.ts`.

