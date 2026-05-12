import React, { useState, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Play, RotateCcw, Save, BookOpen, Settings2, TrendingUp } from 'lucide-react';
import type { AllometryInputs, AllometryMethod, AnimalDataPoint, AllometryResults as AllometryResultsType } from '@/types';
import { useAppStore } from '@/store';
import { runAllometry } from '@/engine/allometry';
import { ALLOMETRY_SAMPLE } from '@/data/samples';
import { HUMAN_DEFAULTS } from '@/data/physiology';
import { FORMULA_REGISTRY } from '@/data/formulas';
import { createRunMetadata } from '@/utils/session';
import SpeciesInputTable from './SpeciesInputTable';
import MethodSelector from './MethodSelector';
import AllometryResultsPanel from './AllometryResults';
import AllometryPlots from './AllometryPlots';
import { WarningBox } from '@/components/shared';

type PlotTab = 'cl' | 'vss' | 'compare' | 'diagnostics';

const DEFAULT_METHODS: AllometryMethod[] = ['simple', 'unbound_fraction', 'rule_of_exponent'];

function initialInputs(): AllometryInputs {
  return { ...ALLOMETRY_SAMPLE, methodsSelected: DEFAULT_METHODS };
}

export default function AllometryModule() {
  const {
    allometryInputs, allometryResults, allometryRunning,
    setAllometryInputs, setAllometryResults, setAllometryRunning,
    saveRun,
  } = useAppStore();

  const [inputs, setInputs] = useState<AllometryInputs>(allometryInputs ?? initialInputs());
  const [results, setResults] = useState<AllometryResultsType | null>(allometryResults);
  const [error, setError] = useState<string | null>(null);
  const [plotTab, setPlotTab] = useState<PlotTab>('cl');
  const [showEquations, setShowEquations] = useState(false);

  const allometryFormulas = FORMULA_REGISTRY.filter(f => f.module === 'allometry');

  const hasFup = inputs.animalData.some(d => d.include && d.fup !== undefined && d.fup > 0);
  const hasBrainWeight = inputs.animalData.some(d => d.include && d.brainWeight_g !== undefined);
  const hasMLP = inputs.animalData.some(d => d.include && d.MLP_years !== undefined);

  const showBrainWeight = inputs.methodsSelected.some(m =>
    ['brain_weight', 'caldwell_tang_2'].includes(m)
  );
  const showMLP = inputs.methodsSelected.some(m =>
    ['MLP', 'caldwell_tang_1', 'rule_of_exponent'].includes(m)
  );

  const handleRun = useCallback(() => {
    setError(null);
    setAllometryRunning(true);
    try {
      const result = runAllometry(inputs);
      setResults(result);
      setAllometryResults(result);
      setAllometryInputs(inputs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAllometryRunning(false);
    }
  }, [inputs, setAllometryInputs, setAllometryResults, setAllometryRunning]);

  const handleReset = useCallback(() => {
    const fresh = initialInputs();
    setInputs(fresh);
    setResults(null);
    setAllometryResults(null);
    setError(null);
  }, [setAllometryResults]);

  const handleSave = useCallback(() => {
    if (!results) return;
    const sessionResult = {
      metadata: createRunMetadata('allometry'),
      compound: inputs.compound,
      inputs,
      methodsSelected: inputs.methodsSelected,
      intermediateResults: {},
      finalResults: results,
      warnings: results.warnings,
      assumptions: [
        'Allometric relationships follow P = a × BW^b.',
        'Absolute CL and Vss used for regression.',
        `Human body weight = ${inputs.humanBodyWeight_kg} kg.`,
        'OLS regression in log-log space.',
      ],
      units: { CL: inputs.CL_units, Vss: inputs.Vss_units, BW: 'kg' },
    };
    saveRun(sessionResult);
    alert('Run saved to session history.');
  }, [inputs, results, saveRun]);

  function updateAnimalData(data: AnimalDataPoint[]) {
    setInputs(prev => ({ ...prev, animalData: data }));
  }

  function updateMethods(methods: AllometryMethod[]) {
    setInputs(prev => ({ ...prev, methodsSelected: methods }));
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* Module header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Allometric Scaling</h1>
              <p className="text-xs text-slate-500">Predict human CL and Vss from multi-species animal data</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEquations(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <BookOpen size={14} /> Equations
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={14} /> Reset
            </button>
            {results && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                <Save size={14} /> Save run
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={allometryRunning || inputs.methodsSelected.length === 0}
              className="flex items-center gap-2 px-5 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              {allometryRunning ? 'Running…' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Equation panel */}
      {showEquations && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-4">
          <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Core Equations — Allometric Scaling</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {allometryFormulas.slice(0, 9).map(f => (
              <div key={f.id} className="bg-white rounded border border-indigo-200 px-3 py-2">
                <p className="text-xs font-semibold text-indigo-700 mb-1">{f.name}</p>
                <p className="font-mono text-xs text-slate-700 bg-slate-50 rounded px-2 py-1">{f.plainEquation}</p>
                <p className="text-[10px] text-slate-400 mt-1 italic">{f.source}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-tab layout */}
      <Tabs.Root defaultValue="data" className="max-w-screen-2xl mx-auto">
        {/* Tab list */}
        <div className="bg-white border-b border-slate-200 px-4">
          <Tabs.List className="flex gap-0" aria-label="Allometry sections">
            <Tabs.Trigger
              value="data"
              className="px-5 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300 transition-colors data-[state=active]:text-indigo-700 data-[state=active]:border-indigo-600 focus:outline-none"
            >
              Data &amp; Methods
            </Tabs.Trigger>
            <Tabs.Trigger
              value="plots"
              className="px-5 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300 transition-colors data-[state=active]:text-indigo-700 data-[state=active]:border-indigo-600 focus:outline-none"
            >
              Plots
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        {/* Tab: Data & Methods */}
        <Tabs.Content value="data" className="p-4 space-y-4 focus:outline-none">
          {/* Full-width animal data table */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <SpeciesInputTable
              data={inputs.animalData}
              onChange={updateAnimalData}
              showBrainWeight={showBrainWeight}
              showMLP={showMLP}
            />
          </div>

          {/* 2-column grid: settings left, results right */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Left column: compound + options + methods */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Compound</h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Compound name</label>
                    <input
                      type="text"
                      value={inputs.compound.name}
                      onChange={e => setInputs(p => ({ ...p, compound: { ...p.compound, name: e.target.value } }))}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                      placeholder="e.g. Compound A"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Human BW (kg)</label>
                      <input
                        type="number"
                        value={inputs.humanBodyWeight_kg}
                        min={10} max={200} step={1}
                        onChange={e => setInputs(p => ({ ...p, humanBodyWeight_kg: parseFloat(e.target.value) }))}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Human fup</label>
                      <input
                        type="number"
                        value={inputs.humanFup ?? ''}
                        step={0.01} min={0} max={1}
                        placeholder="0.08"
                        onChange={e => setInputs(p => ({ ...p, humanFup: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                  {(showBrainWeight || showMLP) && (
                    <div className="grid grid-cols-2 gap-2">
                      {showBrainWeight && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Human BrW (g)</label>
                          <input
                            type="number"
                            value={inputs.humanBrainWeight_g ?? HUMAN_DEFAULTS.brainWeight_g}
                            step={10}
                            onChange={e => setInputs(p => ({ ...p, humanBrainWeight_g: parseFloat(e.target.value) }))}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}
                      {showMLP && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Human MLP (yr)</label>
                          <input
                            type="number"
                            value={inputs.humanMLP_years ?? HUMAN_DEFAULTS.MLP_years}
                            step={1}
                            onChange={e => setInputs(p => ({ ...p, humanMLP_years: parseFloat(e.target.value) }))}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Prediction Options</h3>
                <div className="space-y-1.5">
                  {[
                    { key: 'predictCL' as const, label: 'Predict CL' },
                    { key: 'predictVss' as const, label: 'Predict Vss' },
                    { key: 'predictHalfLife' as const, label: 'Predict t½ = 0.693×Vss/CL' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inputs[key]}
                        onChange={e => setInputs(p => ({ ...p, [key]: e.target.checked }))}
                        className="accent-indigo-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4 overflow-y-auto max-h-[600px]">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Settings2 size={12} /> Allometric Methods
                </h3>
                <MethodSelector
                  selected={inputs.methodsSelected}
                  onChange={updateMethods}
                  availableFup={hasFup || (inputs.humanFup !== undefined)}
                  availableBrainWeight={hasBrainWeight}
                  availableMLP={hasMLP}
                />
              </div>
            </div>

            {/* Right column: results panel (only when available) */}
            <div>
              {results ? (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <AllometryResultsPanel results={results} inputs={inputs} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">
                  <TrendingUp size={36} className="mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Results will appear here</p>
                  <p className="text-xs mt-1">Click <strong>Run Analysis</strong> to get predictions</p>
                </div>
              )}
            </div>
          </div>

          {/* Warnings and errors below */}
          {results && results.warnings.length > 0 && (
            <WarningBox warnings={results.warnings} title="Analysis Warnings" />
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}
        </Tabs.Content>

        {/* Tab: Plots */}
        <Tabs.Content value="plots" className="p-4 focus:outline-none">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            {results ? (
              <AllometryPlots
                inputs={inputs}
                results={results}
                activeTab={plotTab}
                onTabChange={setPlotTab}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <TrendingUp size={48} className="mb-3 text-slate-300" />
                <p className="text-sm font-medium">Graphs will appear after running the analysis</p>
                <p className="text-xs mt-1">Configure inputs and click <strong>Run Analysis</strong></p>
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
