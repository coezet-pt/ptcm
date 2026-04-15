import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { POWERTRAINS, POWERTRAIN_COLORS } from '@/lib/constants/extracted';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; }

export default function StockChart({ years }: Props) {
  const data = useMemo(() =>
    years.map(y => {
      const row: Record<string, number> = { year: y.year };
      for (const pt of POWERTRAINS) row[pt] = Math.round(y.stockByPT[pt]);
      return row;
    }), [years]);

  const csvData = useMemo(() => data.map(d => ({ ...d })), [data]);

  return (
    <ChartCard title="Fleet Stock by Powertrain" description="Vehicles on road" csvData={csvData} csvFilename="fleet_stock">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10 }} width={45} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          {[...POWERTRAINS].reverse().map(pt => (
            <Area key={pt} type="monotone" dataKey={pt} stackId="1"
              fill={POWERTRAIN_COLORS[pt]} stroke={POWERTRAIN_COLORS[pt]} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
