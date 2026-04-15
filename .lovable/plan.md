

# Add Diagnostic Dump to useSimulation.ts

## What

Modify `runSimulation` to capture and log intermediate values (shares2045, shares2055, annualSales) when running in the browser, then output the 4-layer diagnostic dump the user specified.

## Changes (1 file)

### `src/hooks/useSimulation.ts`

Expand `runSimulation` to log diagnostics after computing the simulation:

1. After computing `shares2045`, `shares2055`, and `annualSales`, add a `if (typeof window !== 'undefined')` block that logs:
   - **Layer 1**: `shares2055` as a table (per-bucket, per-PT shares in exponential notation)
   - **Layer 2**: Aggregated 2055 share targets (weighted by `bucket.tivShare2045`) — what PTTM actually receives
   - **Layer 3**: Gompertz/Weibull parameters for B12 (startYear from `START_OF_SUPPLY`, AB from shares2055, Z from shares2045, W from `PTTM_PILOT_SHARE`)
   - **Layer 4**: PTTM share output at years 2030, 2040, 2045, 2055 from `annualSales`

2. Need additional imports: `START_OF_SUPPLY`, `PTTM_PILOT_SHARE` from extracted.ts, and `POWERTRAINS` for iteration.

3. The diagnostic runs unconditionally (no `__SIM_DEBUG__` gate) since the user wants to see it immediately. Can be removed after diagnosis.

No other files change.

