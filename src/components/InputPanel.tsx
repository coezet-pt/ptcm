import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Undo2 } from 'lucide-react';
import ParameterRow from './ParameterRow';
import PolicyLevers from './PolicyLevers';
import { useScenario } from '@/contexts/ScenarioContext';
import type { ParameterKey } from '@/lib/types';

const PARAM_KEYS: ParameterKey[] = [
  'diesel_price_per_l',
  'cng_price_per_kg',
  'lng_price_per_kg',
  'green_h2_production_per_kg',
  'grey_h2_production_per_kg',
  'h2_compression_storage_per_kg',
  'electricity_per_kwh',
  'battery_cost_per_kwh',
  'fuel_cell_cost_per_kw',
  'lng_tank_cost_per_kg',
  'h2_tank_cost_per_kg',
  'adblue_per_l',
  'diesel_vehicle_growth',
  'engine_trans_growth',
  'e_powertrain_growth',
];

export default function InputPanel() {
  const { isDirty, applyChanges, discardChanges } = useScenario();

  return (
    <div className="space-y-6">
      {/* Section 1: Cost Trajectories */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Cost Trajectories</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Parameter</th>
                <th className="text-left py-2 px-2 font-medium">Unit</th>
                <th className="text-right py-2 px-2 font-medium">Base (2025)</th>
                <th className="text-right py-2 px-2 font-medium">Δ 2026-30</th>
                <th className="text-right py-2 px-2 font-medium">Δ 2031-40</th>
                <th className="text-right py-2 px-2 font-medium">Δ 2041-50</th>
                <th className="text-right py-2 px-2 font-medium">Δ 2051-55</th>
              </tr>
            </thead>
            <tbody>
              {PARAM_KEYS.map(k => (
                <ParameterRow key={k} paramKey={k} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Section 2: Policy Levers */}
      <PolicyLevers />

      {/* Sticky Apply / Discard bar */}
      <div className="sticky bottom-0 z-20 -mx-4 px-4 py-3 bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <Badge variant="outline" className="text-warning border-warning">
              Unapplied changes
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Charts are up to date</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty}
            onClick={discardChanges}
            className="gap-1.5"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!isDirty}
            onClick={applyChanges}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Apply Changes (Go)
          </Button>
        </div>
      </div>
    </div>
  );
}
