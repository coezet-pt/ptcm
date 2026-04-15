# Fix Stale Vite Cache + Add Arg Trace Diagnostic

## Problem

The source code in `choiceModel.ts` is correct (uses `ELASTICITIES.TCO * GLOBAL_MULTIPLIER`), but the running app shows BET TCO factor = 4976 instead of 7.186. Grep confirms no file imports `CHOICE_FACTORS` anymore. This is a **Vite cache serving stale code**.

## Steps

### Step 1 — Force clean rebuild

```bash
rm -rf node_modules/.vite dist build .next node_modules/.cache
```

Then let Vite restart. This alone should fix the runtime values.

### Step 2 — Add arg trace diagnostic to `choiceModel.ts`

Before the existing runtime check (line 105), add a second debug flag `__debugDone2` and a detailed trace block that logs:

- Diesel TCO, BET TCO, ratio
- `ELASTICITIES.TCO` and `GLOBAL_MULTIPLIER` values at runtime
- Computed arg via `ELASTICITIES.TCO * GLOBAL_MULTIPLIER * (ratio - 1)`
- `Math.exp(arg)` — what the formula *should* produce
- The actually stored `factors.TCO` — what was *actually* stored

This trace will definitively show whether the bug is in computation or post-computation mutation.

### Step 3 — Verify

After cache clear + rebuild, the runtime check should show `~7.186`. If it does, the arg trace will confirm, and we can check the B1 2045 verification block for share accuracy.

### Files changed

- `src/lib/sim/choiceModel.ts` — add `__debugDone2` arg trace block
- Vite cache cleared via shell command

&nbsp;

Approved. One add: at the very top of `src/lib/sim/choiceModel.ts`, add a version comment like `// v3 - multiplier fix verified - <today's date>`. Forces Vite to bust any path-based cache. Then ship.

After it deploys, the very first thing to verify is the bundle hash in DevTools (Network tab) — confirm it's NOT `index-CzAjiCGt.js`. If you see that same hash, the deploy didn't actually rebuild and we're looking at the same broken bundle. Paste the new hash + the runtime check output.