

# Rename "BAU" → "Basic", Add Apply (Go) Button, Add Excel Export

## 1. Rename "BAU" to "Basic" (display-only)

Keep the internal scenario key as `BAU` everywhere (DB row, `BAU_PARAMETERS`, `BAU_POLICY`, sanity checks, scenarios.ts, debug logs) — renaming the underlying key would require DB migrations and touch ~7 files of code that reference it as a baseline identifier. Instead, change only what the user sees.

**`src/components/ScenarioPicker.tsx`**
- Display label `Basic` for the `BAU` value in the dropdown.
- Reset button: `Reset to Basic` (still calls `resetToBAU`).
- Map: `{ BAU: 'Basic', 'BWS-1': 'BWS-1', 'BWS-2': 'BWS-2', BEST: 'BEST', Custom: 'Custom' }`.

The diagnostic console logs and sanity-check messages still say "BAU" — that's developer-only output and doesn't appear in the UI.

## 2. Apply ("Go") button — defer recompute until user clicks

Today every keystroke in `InputPanel` / `PolicyLevers` calls `updateParameter` / `updatePolicy`, which mutates `config` in `ScenarioContext`, which triggers `useSimulation` (debounced 300ms) and rerenders all charts.

Switch to a **draft + applied** model in `ScenarioContext`:

- Add `draftConfig` (the live edited values that the form binds to) and keep `config` (the values the simulation uses).
- `updateParameter` / `updatePolicy` mutate `draftConfig` only. They also flip `activeScenario` to `Custom` and set a new `isDirty` flag.
- New `applyChanges()` copies `draftConfig` → `config`, clears `isDirty`.
- New `discardChanges()` copies `config` → `draftConfig`, clears `isDirty`.
- `setActiveScenario(name)` and `resetToBAU()` update both `config` and `draftConfig` together (preset switching applies immediately, no Go required).

**`src/components/InputPanel.tsx`**
- Add a sticky action bar at the bottom of the panel: `Apply Changes (Go)` primary button + `Discard` secondary button.
- Both buttons disabled when `!isDirty`.
- When `isDirty`, show a small "Unapplied changes" badge so the user knows the charts are stale.

`ParameterRow` and `PolicyLevers` read from `draftConfig` instead of `config` (rename the `useScenario()` field they consume).

`useSimulation(config)` in `Index.tsx` keeps using the applied `config` — no change there. The 300ms debounce in `useSimulation` stays as a safety net.

## 3. Excel (.xlsx) export alongside CSV

**`src/lib/exporters.ts`** — add `exportXLSX(data, filename, sheetName?)` using the `xlsx` (SheetJS) library. Single sheet, headers from object keys, auto-sized columns.

```text
exportXLSX(rows, 'annual_sales')  →  annual_sales.xlsx
```

**`src/components/ChartCard.tsx`** — in the data-table dropdown area, add a third button **`Download XLSX`** next to the existing `Download CSV`. Both consume the same `csvData` rows, so every chart gets Excel export automatically with no per-chart changes.

Add `xlsx` to dependencies (`npm i xlsx`).

## Files changed

- `src/components/ScenarioPicker.tsx` — label map BAU→Basic, button text
- `src/contexts/ScenarioContext.tsx` — draftConfig, isDirty, applyChanges, discardChanges
- `src/components/InputPanel.tsx` — sticky apply/discard bar, dirty badge
- `src/components/ParameterRow.tsx` — read draftConfig
- `src/components/PolicyLevers.tsx` — read draftConfig
- `src/lib/exporters.ts` — add `exportXLSX`
- `src/components/ChartCard.tsx` — XLSX button
- `package.json` — add `xlsx`

## Not changed

- DB scenario row name (`BAU` stays)
- `BAU_PARAMETERS`, `BAU_POLICY`, `resetToBAU`, sanity check labels
- Scenario switching (preset select still applies instantly — only manual edits require Go)
- Simulation math, chart components, CSV format

