import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { POWERTRAINS, POWERTRAIN_COLORS } from '@/lib/constants/extracted';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; }

export default function ShareChart({ years }: Props) {
  const data = useMemo(() =>
    years.map(y => {
      const row: Record<string, number> = { year: y.year };
      for (const pt of POWERTRAINS) row[pt] = y.shareByPT[pt];
      return row;
    }), [years]);

  const csvData = useMemo(() =>
    data.map(d => {
      const row: Record<string, unknown> = { year: d.year };
      for (const pt of POWERTRAINS) row[pt] = `${((d[pt] as number) * 100).toFixed(2)}%`;
      return row;
    }), [data]);

  return (
    <ChartCard title="Market Share by Powertrain" description="% of annual sales" csvData={csvData} csvFilename="market_share">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} stackOffset="expand" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} width={40} />
          <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} labelFormatter={l => `Year ${l}`} />
          {[...POWERTRAINS].reverse().map(pt => (
            <Area key={pt} type="monotone" dataKey={pt} stackId="1"
              fill={POWERTRAIN_COLORS[pt]} stroke={POWERTRAIN_COLORS[pt]} fillOpacity={0.8} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
