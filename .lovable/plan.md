

# Fix PTTM Gompertz & Weibull Formulas

## Summary

Replace the simplified Gompertz and Weibull functions in `pttm.ts` with the Excel-accurate versions that include quadratic correction (Gompertz) and 2025 anchor injection with phase-out (Weibull). Remove maturity-year clamping. Add verification logging.

## Changes

### 1. `src/lib/sim/pttm.ts` — Full rewrite of curve functions

**Gompertz (`gompertzShare`):** New point-wise function taking `year, startYear, inflectionYear, pilotShare, share2045, share2055`. Computes main Gompertz normalized to hit AB at 2055, then adds quadratic correction term `correctionCoef * (year - inflection) * (2055 - year)` for years between inflection and 2055, forcing curve through Z at 2045.

**Weibull (`weibullShare`):** New point-wise function taking `year, startYear, peakYear, alpha, peakShare2045, units2025, tiv2025`. Normalizes kernel to hit peak at 2045, injects 2025 anchor share with quadratic decay over 20 years, applies linear phase-out from 2045→2055.

**Remove:** Delete `maturityYears` map, remove `maturityYear` parameter from Gompertz calls, delete the warning block.

**Update `computePTTM`:** Change per-bucket loops to call the new point-wise functions year-by-year. Gompertz PTs now also need `shares2045` (for Z target). Weibull PTs need `units2025` and `tiv2025` constants.

### 2. `src/hooks/useSimulation.ts` — Add verification block

Add `__SIM_DEBUG__` gated verification after the diagnostic dump. Accesses `result.years[idx].shareByPT` for years 2030/2045/2055 and compares against expected BAU values, logging pass/fail per powertrain.

### Files touched
- `src/lib/sim/pttm.ts` — rewrite Gompertz/Weibull, remove maturity clamping
- `src/hooks/useSimulation.ts` — add verification block

No changes to `choiceModel.ts`, `tco.ts`, or `stockEmissions.ts`.

