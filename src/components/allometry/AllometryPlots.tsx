import React, { useMemo } from 'react';
// @ts-ignore — plotly type workaround
import Plot from 'react-plotly.js';
import type { AllometryResults, AllometryInputs } from '@/types';
import { formatNumber } from '@/utils/export';

interface Props {
  inputs: AllometryInputs;
  results: AllometryResults;
  activeTab?: 'cl' | 'vss' | 'compare' | 'diagnostics';
  onTabChange?: (tab: 'cl' | 'vss' | 'compare' | 'diagnostics') => void;
}

const SPECIES_COLORS: Record<string, string> = {
  mouse: '#6366f1',
  rat: '#f59e0b',
  rabbit: '#10b981',
  guinea_pig: '#84cc16',
  hamster: '#a78bfa',
  dog: '#3b82f6',
  monkey: '#ef4444',
  cynomolgus_monkey: '#f97316',
  rhesus_monkey: '#ec4899',
  minipig: '#8b5cf6',
  human: '#1e293b',
  custom: '#64748b',
};

const SPECIES_SYMBOLS: Record<string, string> = {
  mouse: 'circle', rat: 'square', rabbit: 'diamond',
  guinea_pig: 'cross', hamster: 'x', dog: 'triangle-up',
  monkey: 'triangle-down', cynomolgus_monkey: 'star',
  rhesus_monkey: 'hexagram', minipig: 'bowtie',
  human: 'star', custom: 'circle-open',
};

function buildRegressionLine(a: number, b: number, bws: number[], nPoints = 100) {
  const minBW = Math.min(...bws);
  const maxBW = Math.max(...bws);
  const logMin = Math.log10(minBW * 0.8);
  const logMax = Math.log10(maxBW * 1.2);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const logBW = logMin + (i / nPoints) * (logMax - logMin);
    xs.push(Math.pow(10, logBW));
    ys.push(a * Math.pow(Math.pow(10, logBW), b));
  }
  return { xs, ys };
}

function LogLogScatterPlot({
  title, xLabel, yLabel, animalPoints, regressionResult, humanPrediction, humanBW,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  animalPoints: { species: string; label: string; bw: number; value: number; predicted?: number }[];
  regressionResult?: { a: number; b: number; rSquared: number } | null;
  humanPrediction?: number;
  humanBW: number;
}) {
  const traces: object[] = useMemo(() => {
    const traceList: object[] = [];

    // Animal scatter points
    for (const pt of animalPoints) {
      traceList.push({
        type: 'scatter',
        x: [pt.bw],
        y: [pt.value],
        mode: 'markers',
        name: pt.label,
        marker: {
          color: SPECIES_COLORS[pt.species] ?? '#64748b',
          symbol: SPECIES_SYMBOLS[pt.species] ?? 'circle',
          size: 10,
          line: { width: 1.5, color: '#fff' },
        },
        customdata: [pt],
        hovertemplate:
          `<b>${pt.label}</b><br>` +
          `BW: %{x:.3g} kg<br>` +
          `Observed: %{y:.3g}<br>` +
          (pt.predicted !== undefined ? `Predicted: ${formatNumber(pt.predicted)}<br>` : '') +
          '<extra></extra>',
      });
    }

    // Regression line
    if (regressionResult && animalPoints.length >= 2) {
      const bws = animalPoints.map(p => p.bw);
      const line = buildRegressionLine(regressionResult.a, regressionResult.b, bws);
      traceList.push({
        type: 'scatter',
        x: line.xs,
        y: line.ys,
        mode: 'lines',
        name: `Fit (R²=${regressionResult.rSquared.toFixed(3)})`,
        line: { color: '#4f46e5', width: 2, dash: 'solid' },
        hoverinfo: 'none',
        showlegend: true,
      });
    }

    // Human prediction point
    if (humanPrediction && humanBW) {
      traceList.push({
        type: 'scatter',
        x: [humanBW],
        y: [humanPrediction],
        mode: 'markers',
        name: 'Human (predicted)',
        marker: {
          color: '#1e293b',
          symbol: 'star',
          size: 16,
          line: { width: 2, color: '#4f46e5' },
        },
        hovertemplate:
          `<b>Human (predicted)</b><br>` +
          `BW: ${humanBW} kg<br>` +
          `Predicted: ${formatNumber(humanPrediction)}<br>` +
          '<extra></extra>',
      });
    }

    return traceList;
  }, [animalPoints, regressionResult, humanPrediction, humanBW]);

  const annotation = regressionResult
    ? `P = ${regressionResult.a.toExponential(2)} × BW^${regressionResult.b.toFixed(3)},  R² = ${regressionResult.rSquared.toFixed(4)}`
    : '';

  return (
    <Plot
      data={traces}
      layout={{
        title: { text: title, font: { size: 13, color: '#1e293b' } },
        xaxis: {
          title: xLabel,
          type: 'log',
          gridcolor: '#e2e8f0',
          showline: true,
          linecolor: '#94a3b8',
          ticks: 'outside',
        },
        yaxis: {
          title: yLabel,
          type: 'log',
          gridcolor: '#e2e8f0',
          showline: true,
          linecolor: '#94a3b8',
          ticks: 'outside',
        },
        annotations: annotation
          ? [{ text: annotation, showarrow: false, xref: 'paper', yref: 'paper', x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top', font: { size: 10, color: '#4f46e5', family: 'monospace' }, bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#4f46e5', borderwidth: 1 }]
          : [],
        legend: { orientation: 'v', x: 1.02, y: 1, bgcolor: 'rgba(255,255,255,0.9)', bordercolor: '#e2e8f0', borderwidth: 1 },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        margin: { t: 40, r: 160, b: 50, l: 60 },
        font: { family: 'Inter, sans-serif', size: 11 },
      }}
      config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', scale: 2 }, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
      style={{ width: '100%', height: 380 }}
      useResizeHandler
    />
  );
}

function MethodComparisonPlot({
  results, humanBW,
}: {
  results: AllometryResults;
  humanBW: number;
}) {
  const methods = results.methodResults.filter(r => r.predictedCL_human !== undefined);

  const trace: object = {
    type: 'bar',
    orientation: 'h',
    x: methods.map(r => r.predictedCL_human ?? 0),
    y: methods.map(r => r.label),
    marker: {
      color: methods.map((_, i) => `hsl(${220 + i * 25}, 65%, 55%)`),
      line: { width: 1, color: '#fff' },
    },
    text: methods.map(r => formatNumber(r.predictedCL_human) + ' mL/min'),
    textposition: 'outside',
    hovertemplate: '<b>%{y}</b><br>Predicted CL: %{x:.3g} mL/min<extra></extra>',
    name: 'CL (mL/min)',
  };

  return (
    <Plot
      data={[trace]}
      layout={{
        title: { text: 'Human CL Prediction by Method', font: { size: 13, color: '#1e293b' } },
        xaxis: { title: 'Predicted Human CL (mL/min)', gridcolor: '#e2e8f0' },
        yaxis: { automargin: true },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        margin: { t: 40, r: 120, b: 60, l: 180 },
        font: { family: 'Inter, sans-serif', size: 11 },
      }}
      config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', scale: 2 } }}
      style={{ width: '100%', height: Math.max(280, methods.length * 40 + 80) }}
      useResizeHandler
    />
  );
}

function BackPredictionPlot({
  results,
}: {
  results: AllometryResults;
}) {
  const traces: object[] = [];
  let maxVal = 0;

  for (const method of results.methodResults.slice(0, 3)) {
    const obs = method.backPredictions.filter(bp => bp.CL_observed !== undefined && bp.CL_predicted !== undefined);
    if (obs.length === 0) continue;
    const xs = obs.map(bp => bp.CL_observed!);
    const ys = obs.map(bp => bp.CL_predicted!);
    maxVal = Math.max(maxVal, ...xs, ...ys);
    traces.push({
      type: 'scatter',
      x: xs,
      y: ys,
      mode: 'markers+text',
      name: method.label,
      text: obs.map(bp => bp.label),
      textposition: 'top center',
      textfont: { size: 9 },
      marker: { size: 9, opacity: 0.85 },
      hovertemplate:
        '<b>%{text}</b><br>Observed: %{x:.3g}<br>Predicted: %{y:.3g}<extra></extra>',
    });
  }

  // Line of identity
  if (maxVal > 0) {
    traces.push({
      type: 'scatter',
      x: [0.001, maxVal * 1.2],
      y: [0.001, maxVal * 1.2],
      mode: 'lines',
      name: 'Line of identity',
      line: { color: '#94a3b8', dash: 'dash', width: 1.5 },
      hoverinfo: 'none',
    });
    // 2× fold error lines
    traces.push({
      type: 'scatter',
      x: [0.001, maxVal * 1.2],
      y: [0.002, maxVal * 2.4],
      mode: 'lines',
      name: '2× fold error',
      line: { color: '#fbbf24', dash: 'dot', width: 1 },
      hoverinfo: 'none',
    });
    traces.push({
      type: 'scatter',
      x: [0.001, maxVal * 1.2],
      y: [0.0005, maxVal * 0.6],
      mode: 'lines',
      name: '0.5× fold error',
      line: { color: '#fbbf24', dash: 'dot', width: 1 },
      showlegend: false,
      hoverinfo: 'none',
    });
  }

  return (
    <Plot
      data={traces}
      layout={{
        title: { text: 'Back-Prediction: Observed vs Predicted CL', font: { size: 13, color: '#1e293b' } },
        xaxis: { title: 'Observed CL (mL/min)', type: 'log', gridcolor: '#e2e8f0', zeroline: false },
        yaxis: { title: 'Predicted CL (mL/min)', type: 'log', gridcolor: '#e2e8f0', zeroline: false },
        legend: { x: 0, y: 1 },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        margin: { t: 40, r: 20, b: 50, l: 60 },
        font: { family: 'Inter, sans-serif', size: 11 },
      }}
      config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'png', scale: 2 } }}
      style={{ width: '100%', height: 360 }}
      useResizeHandler
    />
  );
}

function DiagnosticsPlot({ results }: { results: AllometryResults }) {
  const method = results.methodResults[0];
  if (!method?.regressionCL) return <p className="text-sm text-slate-400 p-4">No regression data available.</p>;

  const reg = method.regressionCL;
  const residuals = reg.residuals;
  const fitted = reg.fittedValues;

  const residualTrace: object = {
    type: 'scatter',
    x: fitted,
    y: residuals,
    mode: 'markers',
    marker: { color: '#6366f1', size: 9 },
    hovertemplate: 'Fitted: %{x:.3g}<br>Residual: %{y:.3g}<extra></extra>',
    name: 'Residuals',
  };

  const zeroLine: object = {
    type: 'scatter',
    x: [Math.min(...fitted) * 0.9, Math.max(...fitted) * 1.1],
    y: [0, 0],
    mode: 'lines',
    line: { color: '#94a3b8', dash: 'dash', width: 1 },
    hoverinfo: 'none',
    showlegend: false,
    name: 'Zero',
  };

  return (
    <Plot
      data={[residualTrace, zeroLine]}
      layout={{
        title: { text: 'Residuals vs Fitted (CL, log scale)', font: { size: 13 } },
        xaxis: { title: 'Fitted ln(CL)', gridcolor: '#e2e8f0' },
        yaxis: { title: 'Residual ln(CL)', gridcolor: '#e2e8f0', zeroline: false },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        margin: { t: 40, r: 20, b: 50, l: 60 },
        font: { family: 'Inter, sans-serif', size: 11 },
      }}
      config={{ responsive: true }}
      style={{ width: '100%', height: 300 }}
      useResizeHandler
    />
  );
}

export default function AllometryPlots({ inputs, results, activeTab = 'cl', onTabChange }: Props) {
  const tabs = [
    { id: 'cl' as const, label: 'CL Plot' },
    { id: 'vss' as const, label: 'Vss Plot' },
    { id: 'compare' as const, label: 'Method Comparison' },
    { id: 'diagnostics' as const, label: 'Diagnostics' },
  ];

  // Build animal points for CL
  const firstMethodCL = results.methodResults.find(r => r.regressionCL);
  const clPoints = inputs.animalData
    .filter(d => d.include && d.CL_abs !== undefined)
    .map(d => {
      const bp = firstMethodCL?.backPredictions.find(b => b.species === d.species && b.label === d.label);
      return {
        species: d.species,
        label: d.label,
        bw: d.bodyWeight_kg,
        value: d.CL_abs!,
        predicted: bp?.CL_predicted,
      };
    });

  const vssPoints = inputs.animalData
    .filter(d => d.include && d.Vss_abs !== undefined)
    .map(d => {
      const bp = firstMethodCL?.backPredictions.find(b => b.species === d.species && b.label === d.label);
      return {
        species: d.species,
        label: d.label,
        bw: d.bodyWeight_kg,
        value: d.Vss_abs!,
        predicted: bp?.Vss_predicted,
      };
    });

  const firstMethodVss = results.methodResults.find(r => r.regressionVss);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange?.(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === t.id
                ? 'bg-white border border-b-white border-slate-200 -mb-px text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-1">
        {activeTab === 'cl' && (
          <LogLogScatterPlot
            title="Allometric Scaling — Clearance"
            xLabel="Body Weight (kg)"
            yLabel="Clearance (mL/min)"
            animalPoints={clPoints}
            regressionResult={firstMethodCL?.regressionCL ? {
              a: firstMethodCL.regressionCL.a,
              b: firstMethodCL.regressionCL.slope,
              rSquared: firstMethodCL.regressionCL.rSquared,
            } : null}
            humanPrediction={firstMethodCL?.predictedCL_human}
            humanBW={inputs.humanBodyWeight_kg}
          />
        )}
        {activeTab === 'vss' && (
          <LogLogScatterPlot
            title="Allometric Scaling — Volume of Distribution"
            xLabel="Body Weight (kg)"
            yLabel="Vss (L)"
            animalPoints={vssPoints}
            regressionResult={firstMethodVss?.regressionVss ? {
              a: firstMethodVss.regressionVss.a,
              b: firstMethodVss.regressionVss.slope,
              rSquared: firstMethodVss.regressionVss.rSquared,
            } : null}
            humanPrediction={firstMethodVss?.predictedVss_human}
            humanBW={inputs.humanBodyWeight_kg}
          />
        )}
        {activeTab === 'compare' && (
          <MethodComparisonPlot results={results} humanBW={inputs.humanBodyWeight_kg} />
        )}
        {activeTab === 'diagnostics' && (
          <BackPredictionPlot results={results} />
        )}
      </div>
    </div>
  );
}
