import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ParameterRow from './ParameterRow';
import PolicyLevers from './PolicyLevers';
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
    </div>
  );
}
