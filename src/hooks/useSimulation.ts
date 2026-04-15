/**
 * Orchestrating hook: timeSeries → tco → choiceModel → pttm → stockEmissions
 * with 300ms debounce and stable memoization [fix #6].
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import type { ScenarioConfig, SimulationResult } from '@/lib/types';
import { BUCKETS } from '@/lib/constants/extracted';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
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
  const ts = buildTimeSeries(config.parameters);
  const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045);
  const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055);
  const shares2045 = computeShares(tco2045, BUCKETS, 2045);
  const shares2055 = computeShares(tco2055, BUCKETS, 2055);
  const annualSales = computePTTM(shares2045, shares2055, config.policy);
  return computeStockEmissions(annualSales);
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
