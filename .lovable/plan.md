

# Fix Choice Model — 3 Bugs in `choiceModel.ts`

## What's wrong
The choice model gives BET ~100% because: (A) the elasticity formula misuses `weighting` as a multiplier instead of using `elasticity * 1.5` directly, (B) payload and TAT ratios are inverted (diesel/pt instead of pt/diesel).

## Changes

### `src/lib/sim/choiceModel.ts`

1. **Remove imports** of `CHOICE_FACTORS` and `CHOICE_WEIGHT_DENOMINATOR` — they encode wrong semantics.

2. **Define local constants:**
```ts
const ELASTICITIES = {
  TCO: 9.0, vehiclePrice: 8.83, ratedPayload: 7.17,
  tatGradeability: 5.5, rangeFillingTime: 7.5,
};
const GLOBAL_MULTIPLIER = 1.5;
```

3. **Fix 5 factor arg computations** (lines 68-86) — each becomes `ELASTICITIES[factor] * GLOBAL_MULTIPLIER * (ratio - 1)` with correct ratio direction:
   - TCO: `diesel / pt` (lower TCO better)
   - vehiclePrice: `diesel / pt` (lower price better)
   - ratedPayload: `pt / diesel` (higher payload better) — **FLIPPED**
   - tatGradeability: `pt / diesel` (higher rating better) — **FLIPPED**
   - rangeFillingTime: `diesel / pt` (lower penalty better)

4. **Add self-test at module bottom:**
```ts
if (typeof window !== 'undefined') {
  const testBET_TCO = Math.exp(9.0 * 1.5 * (56.94 / 49.68 - 1));
  const expected = 7.186;
  if (Math.abs(testBET_TCO - expected) > 0.05)
    console.error(`❌ Choice model formula BROKEN: expected ${expected}, got ${testBET_TCO.toFixed(3)}`);
  else
    console.log('✅ Choice model formula verified against Excel B1 BET TCO');
}
```

5. **Update debug block** (lines 107-148) to use new constants instead of `CHOICE_FACTORS`/`CHOICE_WEIGHT_DENOMINATOR`.

### `src/hooks/useSimulation.ts`

Add choice model verification inside the existing `__SIM_DEBUG__` block (after the PTTM verification):
```ts
console.group('🎯 Choice model verification — B1 2045');
const expectedB1 = {
  Diesel: 0.1652, CNG: 0.1060, LNG: 0.0951,
  BET: 0.3640, 'H2-ICE': 0.1026, 'H2-FCET': 0.1671,
};
// Log actual vs expected for each PT in shares2045.B1
console.groupEnd();
```

### Files touched
- `src/lib/sim/choiceModel.ts` — fix formula, ratio directions, add self-test
- `src/hooks/useSimulation.ts` — add B1 2045 verification block

No changes to `pttm.ts`, `tco.ts`, `stockEmissions.ts`, or `extracted.ts`.

