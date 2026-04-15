

# Fix Misleading Assertion + Ensure TCO Diagnostic Fires

## Problem
The `❌❌❌ Formula in loop is STILL using old multiplier` assertion in `choiceModel.ts` (line 134-136) is misleading — the choice model formula is correct, but TCO inputs from `tco.ts` are wrong, causing large factor values. The assertion blames the wrong file.

## Changes

### `src/lib/sim/choiceModel.ts`
**Lines 134-136** — Replace the misleading error assertion:
```typescript
// DELETE:
if (tcoFactorBET > 100) {
  console.error('❌❌❌ Formula in loop is STILL using old multiplier. Self-test is misleading.');
}

// REPLACE WITH:
console.log(`ℹ️ B1 BET TCO factor = ${tcoFactorBET.toFixed(3)}. Excel reference = 7.186. ` +
            `Discrepancy means TCO INPUTS are wrong — check tco.ts, not choiceModel.ts.`);
```

### `src/lib/sim/tco.ts`
The TCO breakdown diagnostic already exists at lines 267-286 and logs all intermediate values (`vehiclePrice`, `tcoPerKm`, `capexPerKm`, `opexPerKm`, `fuelCostPerKm`, `maintPerKm`, `tollPerKm`, `resalePct`) for B1 2045 when `__SIM_DEBUG__` is set. **No changes needed** — it's already there.

### Verification
After deploying, check DevTools console:
- `❌❌❌` message should be **gone**
- `ℹ️ B1 BET TCO factor` message should appear
- `🔬 TCO TRACE — B1 2045` group should appear with full breakdown

