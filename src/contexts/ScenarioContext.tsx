import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ScenarioConfig, PolicyConfig, ParameterKey } from '@/lib/types';
import type { ScenarioName } from '@/lib/constants/extracted';
import { BAU_PARAMETERS, BAU_POLICY } from '@/lib/constants/extracted';
import { SCENARIO_CONFIGS } from '@/lib/constants/scenarios';

// Build the default BAU config from constants
const bauConfig: ScenarioConfig = {
  parameters: { ...BAU_PARAMETERS } as ScenarioConfig['parameters'],
  policy: { ...BAU_POLICY },
};

interface ScenarioContextValue {
  presets: Record<ScenarioName, { id: string; description: string; config: ScenarioConfig }>;
  loading: boolean;
  activeScenario: ScenarioName | 'Custom';
  /** Applied config — what the simulation uses */
  config: ScenarioConfig;
  /** Draft config — what the input forms bind to */
  draftConfig: ScenarioConfig;
  /** True when draftConfig differs from applied config */
  isDirty: boolean;
  setActiveScenario: (name: ScenarioName | 'Custom') => void;
  updateParameter: (key: ParameterKey, field: string, value: number) => void;
  updatePolicy: <K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) => void;
  resetToBAU: () => void;
  applyChanges: () => void;
  discardChanges: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<ScenarioContextValue['presets']>({} as any);
  const [loading, setLoading] = useState(true);
  const [activeScenario, setActiveScenarioState] = useState<ScenarioName | 'Custom'>('BAU');
  const [config, setConfig] = useState<ScenarioConfig>(structuredClone(bauConfig));
  const [draftConfig, setDraftConfig] = useState<ScenarioConfig>(structuredClone(bauConfig));
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    supabase
      .from('scenarios')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const map: any = {};
          for (const row of data) {
            const name = row.name as ScenarioName;
            const hasConfig = row.config && Object.keys(row.config as object).length > 0;
            const fallback = SCENARIO_CONFIGS[name] ?? bauConfig;
            map[name] = {
              id: row.id,
              description: row.description || '',
              config: hasConfig ? (row.config as unknown as ScenarioConfig) : structuredClone(fallback),
            };
          }
          setPresets(map);
        }
        setLoading(false);
      });
  }, []);

  const setActiveScenario = useCallback((name: ScenarioName | 'Custom') => {
    setActiveScenarioState(name);
    if (name !== 'Custom' && presets[name]) {
      const next = structuredClone(presets[name].config);
      setConfig(next);
      setDraftConfig(structuredClone(next));
      setIsDirty(false);
    }
  }, [presets]);

  const updateParameter = useCallback((key: ParameterKey, field: string, value: number) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: { ...prev.parameters[key], [field]: value },
      },
    }));
  }, []);

  const updatePolicy = useCallback(<K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => ({
      ...prev,
      policy: { ...prev.policy, [key]: value },
    }));
  }, []);

  const resetToBAU = useCallback(() => {
    setActiveScenarioState('BAU');
    const next = structuredClone(bauConfig);
    setConfig(next);
    setDraftConfig(structuredClone(next));
    setIsDirty(false);
  }, []);

  const applyChanges = useCallback(() => {
    setConfig(structuredClone(draftConfig));
    setIsDirty(false);
  }, [draftConfig]);

  const discardChanges = useCallback(() => {
    setDraftConfig(structuredClone(config));
    setIsDirty(false);
  }, [config]);

  return (
    <ScenarioContext.Provider value={{
      presets, loading, activeScenario, config, draftConfig, isDirty,
      setActiveScenario, updateParameter, updatePolicy, resetToBAU,
      applyChanges, discardChanges,
    }}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be inside ScenarioProvider');
  return ctx;
}
