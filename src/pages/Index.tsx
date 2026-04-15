import { ScenarioProvider, useScenario } from '@/contexts/ScenarioContext';
import ScenarioPicker from '@/components/ScenarioPicker';
import InputPanel from '@/components/InputPanel';
import { useSimulation } from '@/hooks/useSimulation';
import { Truck } from 'lucide-react';
import { useEffect } from 'react';

function DashboardContent() {
  const { config } = useScenario();
  const simResult = useSimulation(config);

  useEffect(() => {
    if (simResult) {
      console.log('SimulationResult:', simResult);
    }
  }, [simResult]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                PTCM Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                India Heavy Truck Fleet Transition 2025–2055
              </p>
            </div>
          </div>
          <ScenarioPicker />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <aside className="space-y-6 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-2">
            <InputPanel />
          </aside>

          <section className="space-y-6">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center min-h-[400px]">
              <p className="text-muted-foreground text-sm">
                {simResult
                  ? `Simulation ready — ${simResult.years.length} years, ZET sales: ${simResult.totalZetSales.toLocaleString()}`
                  : 'Running simulation…'}
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <ScenarioProvider>
      <DashboardContent />
    </ScenarioProvider>
  );
}
