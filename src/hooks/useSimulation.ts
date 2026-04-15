/**
 * Orchestrating hook: timeSeries → tco → choiceModel → pttm → stockEmissions
 * with 300ms debounce and stable memoization [fix #6].
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import type { ScenarioConfig, SimulationResult } from '@/lib/types';
import { BUCKETS, START_OF_SUPPLY, PTTM_PILOT_SHARE, POWERTRAINS } from '@/lib/constants/extracted';
import { buildTimeSeries, START_YEAR } from '@/lib/sim/timeSeries';
import { computeTCO } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';

/** Stable JSON stringify — sorts keys recursively [fix #6] */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + stableStringify((obj as any)[k])).join(',') + '}';
}

function runSimulation(config: ScenarioConfig): SimulationResult {
  const ts = buildTimeSeries(config.parameters, config.policy);
  const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045);
  const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055);
  const shares2045 = computeShares(tco2045, BUCKETS, 2045, config.policy);
  const shares2055 = computeShares(tco2055, BUCKETS, 2055, config.policy);
  const annualSales = computePTTM(shares2045, shares2055, config.policy);
  const result = computeStockEmissions(annualSales);

  // 🔬 Diagnostic dump
  if (typeof window !== 'undefined') {
    console.group('🔬 PTCM Diagnostic Dump — BAU 2055');

    // Layer 1: choice model output
    console.group('Layer 1 — Choice Model 2055 shares');
    console.table(
      Object.fromEntries(
        Object.entries(shares2055).map(([bucket, pts]) => [
          bucket,
          Object.fromEntries(
            Object.entries(pts).map(([pt, v]) => [pt, (v as number).toExponential(3)])
          )
        ])
      )
    );
    console.groupEnd();

    // Layer 2: aggregated 2055 share targets
    console.group('Layer 2 — Aggregated 2055 share targets passed to PTTM');
    const agg2055: Record<string, number> = {};
    for (const pt of ['Diesel','CNG','LNG','BET','H2-ICE','H2-FCET']) {
      agg2055[pt] = Object.entries(shares2055).reduce((sum, [bid, pts]) => {
        const bucket = BUCKETS.find(b => b.id === bid);
        return sum + ((pts as any)[pt] || 0) * (bucket?.tivShare2045 || 0);
      }, 0);
    }
    console.table(agg2055);
    console.groupEnd();

    // Layer 3: Gompertz/Weibull params for B12
    console.group('Layer 3 — Gompertz/Weibull params for B12');
    for (const pt of ['CNG','LNG','BET','H2-ICE','H2-FCET']) {
      console.log(pt, {
        startYear: (START_OF_SUPPLY as any)['28T Rigid']?.[pt],
        AB_2055: (shares2055 as any).B12?.[pt],
        Z_2045: (shares2045 as any).B12?.[pt],
        W_pilot: (PTTM_PILOT_SHARE as any)[pt] ?? 'n/a (Weibull)',
      });
    }
    console.groupEnd();

    // Layer 4: PTTM annual share output
    console.group('Layer 4 — PTTM share output for years 2030, 2040, 2045, 2055');
    for (const year of [2030, 2040, 2045, 2055]) {
      const idx = year - START_YEAR;
      const entry = annualSales[idx];
      if (entry) {
        console.log(year, { share: { ...entry.share }, sales: { ...entry.sales } });
      } else {
        console.log(year, 'no data');
      }
    }
    console.groupEnd();

    console.groupEnd();
  }

  return result;
}

export function useSimulation(config: ScenarioConfig): SimulationResult | null {
  const configKey = useMemo(() => stableStringify(config), [config]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const r = runSimulation(config);
        setResult(r);
      } catch (e) {
        console.error('[useSimulation] Error:', e);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  return result;
}
