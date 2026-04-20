import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { ParameterKey, ParameterConfig } from '@/lib/types';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { useScenario } from '@/contexts/ScenarioContext';

const DELTA_LABELS = ['2026-30', '2031-40', '2041-50', '2051-55'] as const;
const DELTA_KEYS = ['d2630', 'd3140', 'd4150', 'd5155'] as const;

interface Props {
  paramKey: ParameterKey;
}

export default function ParameterRow({ paramKey }: Props) {
  const { draftConfig, updateParameter } = useScenario();
  const meta = PARAMETER_META[paramKey];
  const param = draftConfig.parameters[paramKey];

  const isGrowthRate = paramKey.includes('growth');

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-2 px-3 text-sm font-medium whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {meta.label}
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[250px]">
              <p>{meta.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </td>
      <td className="py-2 px-2">
        <span className="text-xs text-muted-foreground">{meta.unit}</span>
      </td>
      <td className="py-2 px-2">
        <Input
          type="number"
          className="h-8 w-24 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={param.baseValue}
          step={isGrowthRate ? 0.01 : 1}
          onChange={e => updateParameter(paramKey, 'baseValue', Number(e.target.value))}
        />
      </td>
      {DELTA_KEYS.map((dk, i) => (
        <td key={dk} className="py-2 px-2">
          <Input
            type="number"
            className="h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={param[dk]}
            step={0.005}
            onChange={e => updateParameter(paramKey, dk, Number(e.target.value))}
          />
        </td>
      ))}
    </tr>
  );
}
