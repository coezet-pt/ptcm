/**
 * Validation harness — run BAU simulation and diff against
 * CoEZET_PTCM_v3.xlsx 'Output Summary' rows 29-59 (years 2025-2055).
 *
 * Column mapping is POSITIONAL (workbook row-2 headers are buggy):
 *   A=year, B=Diesel sale,  C=Diesel stock,
 *           D=BET sale,     E=BET stock,
 *           F=H2-ICE sale,  G=H2-ICE stock,
 *           H=FCET sale,    I=FCET stock,
 *           J=CNG sale,     K=CNG stock,
 *           L=LNG sale,     M=LNG stock,
 *           N=Total sale.
 */
import { SCENARIO_CONFIGS } from '../src/lib/constants/scenarios';
import { BUCKETS } from '../src/lib/constants/extracted';
import { buildTimeSeries } from '../src/lib/sim/timeSeries';
import { computeTCO } from '../src/lib/sim/tco';
import { computeShares } from '../src/lib/sim/choiceModel';
import { computePTTM } from '../src/lib/sim/pttm';
import { computeStockEmissions } from '../src/lib/sim/stockEmissions';
import fs from 'fs';
import path from 'path';

const audit = JSON.parse(
  fs.readFileSync(path.join(import.meta.dir, 'extracted_audit.json'), 'utf-8'),
);

const config = SCENARIO_CONFIGS.BAU;
const ts = buildTimeSeries(config.parameters, config.policy);
const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045, config.fixed, config.segmentBasePrices);
const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055, config.fixed, config.segmentBasePrices);
const shares2045 = computeShares(tco2045, BUCKETS, 2045, config.policy);
const shares2055 = computeShares(tco2055, BUCKETS, 2055, config.policy);
const annual = computePTTM(shares2045, shares2055, config.policy);
const sim = computeStockEmissions(annual);

// ── 1. Headers ──────────────────────────────────────────────────────────────
console.log('\n=== (1) OUTPUT SUMMARY HEADER ROWS (raw, workbook-as-shipped) ===');
console.log('Row 1:', JSON.stringify(audit.output_summary_headers?.row1 ?? '(re-run extract_constants.py)'));
console.log('Row 2:', JSON.stringify(audit.output_summary_headers?.row2 ?? ''));
console.log('Positional map used by harness:');
console.log('  A=year | B=Diesel sale | C=Diesel stock | D=BET sale | E=BET stock');
console.log('  F=H2ICE sale | G=H2ICE stock | H=FCET sale | I=FCET stock');
console.log('  J=CNG sale | K=CNG stock | L=LNG sale | M=LNG stock | N=Total');

// ── 2. B1 2045 TCO trace ────────────────────────────────────────────────────
console.log('\n=== (2) B1 2045 TCO TRACE (₹/km) — targets Diesel 56.94, BET 49.68 ===');
const b1 = tco2045['B1'];
if (b1) {
  console.log(`  Diesel: ${b1.Diesel.tcoPerKm.toFixed(2)}  (target 56.94)`);
  console.log(`  BET   : ${b1.BET.tcoPerKm.toFixed(2)}  (target 49.68)`);
  console.log(`  ratio Diesel/BET = ${(b1.Diesel.tcoPerKm / b1.BET.tcoPerKm).toFixed(4)}`);
  console.log('  breakdown (Diesel | BET):');
  const k = ['capexPerKm','opexPerKm','fuelCostPerKm','maintPerKm','manpowerPerKm','tollPerKm'] as const;
  for (const f of k) {
    console.log(`    ${f.padEnd(18)} ${(b1.Diesel[f] as number).toFixed(2).padStart(8)} | ${(b1.BET[f] as number).toFixed(2).padStart(8)}`);
  }
}

// ── 3 & 4. Sales + Stock diff tables ────────────────────────────────────────
const PTS = ['Diesel', 'CNG', 'LNG', 'BET', 'H2-ICE', 'H2-FCET'] as const;
const FLAG = 2;
const fmt = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(0));
const pct = (a: number, b: number) =>
  b === 0 ? (a === 0 ? 0 : Infinity) : ((a - b) / b) * 100;

function diffTable(title: string, getSim: (y: number) => Record<string, number>, refKey: 'sale' | 'stock') {
  console.log(`\n=== ${title} (Δ% = sim − ref; * = |Δ|>${FLAG}%) ===`);
  console.log('Year   ' + PTS.map(p => p.padStart(22)).join(' '));
  let flagged = 0;
  for (let year = 2025; year <= 2055; year++) {
    const refRow = audit.bau_reference[year] || audit.bau_reference[String(year)];
    if (!refRow) continue;
    const simRow = getSim(year);
    const cells = PTS.map(pt => {
      const sim = simRow[pt] ?? 0;
      // refRow stored with sale keys (when refKey='sale') or stock keys
      const refKeyName = refKey === 'sale' ? pt : `${pt}_stock`;
      const refv = Number(refRow[refKeyName] ?? 0);
      const d = pct(sim, refv);
      const small = refv < 10 && Math.abs(sim - refv) < 10;
      const tag = Math.abs(d) > FLAG && !small ? '*' : ' ';
      if (tag === '*') flagged++;
      const dStr = isFinite(d) ? d.toFixed(1) + '%' : '—';
      return `${fmt(sim).padStart(9)}/${fmt(refv).padStart(9)}${tag}${dStr.padStart(7)}`;
    });
    console.log(`${year}  ${cells.join(' ')}`);
  }
  console.log(`Flagged cells: ${flagged} / ${31 * PTS.length}`);
}

diffTable('(3) BAU SALES — sim vs Output Summary', year => {
  const row = sim.years.find(y => y.year === year);
  return row ? row.salesByPT as any : {};
}, 'sale');

diffTable('(4) BAU STOCK — sim vs Output Summary', year => {
  const row = sim.years.find(y => y.year === year);
  return row ? row.stockByPT as any : {};
}, 'stock');

// ── 5. 2025-2030 CNG/LNG anchor check ───────────────────────────────────────
console.log('\n=== (5) 2025-2030 CNG/LNG ANCHOR CHECK ===');
console.log('Year   CNG sim / ref       LNG sim / ref');
for (let year = 2025; year <= 2030; year++) {
  const row = sim.years.find(y => y.year === year)!;
  const ref = audit.bau_reference[year] || audit.bau_reference[String(year)];
  console.log(
    `${year}  ${fmt(row.salesByPT['CNG']).padStart(8)} / ${fmt(Number(ref.CNG)).padStart(8)}    ` +
    `${fmt(row.salesByPT['LNG']).padStart(8)} / ${fmt(Number(ref.LNG)).padStart(8)}`,
  );
}
