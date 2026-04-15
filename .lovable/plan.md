

# Fix Simulation to Match Excel — 3 Steps

## Step 1 — Fix BET/FCET vehicle price in `tco.ts`

**Bug**: BET price = `engine_trans * growth + e_powertrain + battery`. This misses the full chassis/cab cost.

**Excel formula**: `diesel_base_price[y] - diesel_engine_trans[y] + e_powertrain[y] + battery`

**Fix in `computeVehiclePrice`**:

```typescript
case 'BET': {
  const dy = year - 2025;
  const dieselBase = base.diesel_total * Math.pow(1.03, dy)
    + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
  const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
  const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
  const batteryCost = bucket.betBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
  const oem = BET_OEM_MARGIN_BY_YEAR[...];
  const raw = dieselBase - dieselPowertrain + ePowertrain + batteryCost;
  const withMargin = raw * (1 + oem);
  // ... incentive logic unchanged
}
```

Same pattern for **FCET**: `dieselBase - dieselPowertrain + ePowertrain + fcCost + batteryCost + h2TankCost`, then OEM margin, then incentive.

Also delete the misleading `❌❌❌` assertion in `choiceModel.ts` and replace with the neutral `ℹ️` info log.

**Validation**: B1 BET 2045 vehicle price should be ~₹65-70L, TCO/km ~49.68.

---

## Step 2 — Fix BAU range concern in `extracted.ts` and `scenarios.ts`

**Bug**: `BAU_POLICY.range_filling_concern_after_2035 = false` removes range/filling penalty after 2035, over-favoring BET.

**Fix**: Set to `true` in `BAU_POLICY` (extracted.ts line 365). Also set to `true` in BWS-1 and BWS-2 (scenarios.ts). Only BEST keeps `false`.

**Validation**: BAU BET share at 2055 should drop from ~100% to ~70%.

---

## Step 3 — Fix diesel double-count in `pttm.ts`

**Bug**: Line 210 sets `s.Diesel = 1 - nonDiesel` (correct residual). Then line 216 adds `OTHER_DIESEL_TIV_SHARE * tiv` to diesel sales again — double-counting.

**Fix**: Remove line 216 (`annual[i].sales.Diesel += OTHER_DIESEL_TIV_SHARE * tiv`). Diesel sales should just be `s.Diesel * tiv` like every other powertrain.

**Validation**: Total sales at 2025/2045/2055 should match BAU baseline (~267k/707k/1.03M).

---

## Files changed
- `src/lib/sim/tco.ts` — BET and FCET vehicle price formula
- `src/lib/sim/choiceModel.ts` — delete misleading assertion
- `src/lib/constants/extracted.ts` — BAU range concern = true
- `src/lib/constants/scenarios.ts` — BWS-1/BWS-2 range concern = true
- `src/lib/sim/pttm.ts` — remove diesel sales double-count

## Process
Sequential: Step 1 first, validate TCO, then Step 2, validate shares, then Step 3, validate totals.

