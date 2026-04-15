

# Add Manpower Cost to TCO

## Changes

### `src/lib/sim/tco.ts`

**1. Add manpower constants** (after line 45):
```typescript
const MANPOWER_BASE_2025_DIESEL = 400000;  // ₹4L/yr (Diesel, CNG, LNG, H2-ICE)
const MANPOWER_BASE_2025_BET    = 460000;  // ₹4.6L/yr (BET, FCET)
const MANPOWER_GROWTH = 0.04534;            // 4.53% YoY — back-solved: (971000/400000)^(1/20)-1
```

**2. Add `manpowerPerKm` to `TCOResult` interface** (line 22-32):
```typescript
export interface TCOResult {
  tcoPerKm: number;
  vehiclePrice: number;
  totalCost: number;
  capexPerKm: number;
  opexPerKm: number;
  fuelCostPerKm: number;
  maintPerKm: number;
  manpowerPerKm: number;   // NEW
  tollPerKm: number;
  resalePct: number;
}
```

**3. Compute manpower and add to opex** (between lines 257-258):
```typescript
const baseManpower = (pt === 'BET' || pt === 'H2-FCET')
  ? MANPOWER_BASE_2025_BET
  : MANPOWER_BASE_2025_DIESEL;
const manpowerPerYear = baseManpower * Math.pow(1 + MANPOWER_GROWTH, dy);
const manpowerPerKm = manpowerPerYear / bucket.annualKm;

const opexPerKm = fuelPerKm + maintPerKm + effectiveToll + manpowerPerKm;
```

**4. Add manpowerPerKm to result object** (line 264-268):
```typescript
ptResults[pt] = {
  tcoPerKm, vehiclePrice: price, totalCost,
  capexPerKm, opexPerKm, fuelCostPerKm: fuelPerKm,
  maintPerKm, manpowerPerKm, tollPerKm: effectiveToll, resalePct,
};
```

**5. Update debug trace** (lines 274-292) to print full component breakdown including manpower, insurance, and adblue verification:
```typescript
if (typeof window !== 'undefined' && targetYear === 2045) {
  const b1 = result['B1'];
  if (b1) {
    console.group('🔬 TCO TRACE — B1 2045 (Excel ref: Diesel=56.94, BET=49.68)');
    for (const pt of POWERTRAINS) {
      const r = b1[pt];
      console.log(pt, {
        vehiclePrice_lakh: (r.vehiclePrice / 100000).toFixed(2),
        tcoPerKm: r.tcoPerKm.toFixed(2),
        capexPerKm: r.capexPerKm.toFixed(2),
        opexPerKm: r.opexPerKm.toFixed(2),
        fuelCostPerKm: r.fuelCostPerKm.toFixed(4),
        maintPerKm: r.maintPerKm.toFixed(4),
        manpowerPerKm: r.manpowerPerKm.toFixed(4),
        tollPerKm: r.tollPerKm.toFixed(4),
        resalePct: r.resalePct,
      });
    }
    console.groupEnd();
  }
}
```

### No other files changed
No choiceModel, scenarios, or sanity check changes.

### Expected output
- Diesel TCO: 41.46 + ~9.0 = ~50.5 ₹/km (target: 56.94)
- BET TCO: 32.74 + ~10.3 = ~43.0 ₹/km (target: 49.68)
- Remaining ~6 ₹/km gap to address in next round

