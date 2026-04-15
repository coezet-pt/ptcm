

# Get Full B1 2045 TCO Breakdown — Make Debug Trace Always-On

## What we know
From the browser console (already captured):
- **B1 2045 Diesel TCO: 41.46** ₹/km (Excel: 56.94) — 27% too low
- **B1 2045 BET TCO: 32.74** ₹/km (Excel: 49.68) — 34% too low
- BET TCO factor: 36.46 (Excel: 7.186) — confirms TCO gap is the root cause
- Choice model formula is correct (SUM, 1.5 multiplier, elasticities all match)

## What we still need
The detailed breakdown (vehicle price, fuel cost/km, capex/km, opex/km) is gated behind `window.__SIM_DEBUG__` which can't be set via browser automation. We need those 4 remaining numbers to know exactly which line in `tco.ts` to fix.

## Plan — One change only

### `src/lib/sim/tco.ts` (lines 273-292)
Remove the `__SIM_DEBUG__` gate on the B1 2045 trace so it always fires. Change line 274 from:

```typescript
if (typeof window !== 'undefined' && (window as any).__SIM_DEBUG__ && targetYear === 2045) {
```

to:

```typescript
if (typeof window !== 'undefined' && targetYear === 2045) {
```

This makes the `🔬 TCO TRACE — B1 2045` log fire on every page load, exposing all 6 numbers in the console without needing to set a flag.

### No other changes
No formula changes. No sanity check changes. No choiceModel changes.

### After deploying
I'll read the console logs and report the full 6-number breakdown so you can tell me which specific line to fix.

