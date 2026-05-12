import React, { useState } from 'react';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { AllometryResults, AllometryInputs, BackPrediction, AllometrySingleMethodResult } from '@/types';
import { formatNumber, exportCSV } from '@/utils/export';

interface Props {
  results: AllometryResults;
  inputs: AllometryInputs;
}

function FoldErrorBadge({ fe }: { fe?: number }) {
  if (fe === undefined || isNaN(fe)) return <span className="text-slate-400">—</span>;
  const within2 = fe >= 0.5 && fe <= 2;
  const within3 = fe >= 0.333 && fe <= 3;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
      within2 ? 'bg-green-100 text-green-800' : within3 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    }`}>
      {fe.toFixed(2)}×
    </span>
  );
}

function MethodResult({ result }: { result: AllometrySingleMethodResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-slate-800">{result.label}</span>
          {result.predictedCL_human !== undefined && (
            <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono">
              CL = {formatNumber(result.predictedCL_human)} mL/min
            </span>
          )}
          {result.predictedVss_human !== undefined && (
            <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-mono">
              Vss = {formatNumber(result.predictedVss_human)} L
            </span>
          )}
          {result.AAFE_CL !== undefined && (
            <span className="text-[11px] text-slate-500">AAFE = {result.AAFE_CL.toFixed(3)}</span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-4 bg-white">
          {/* Regression summary */}
          {result.regressionCL && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">CL Regression</p>
              <div className="equation-block font-mono text-sm">
                CL = {result.regressionCL.a.toExponential(3)} × BW
                <sup>{result.regressionCL.slope.toFixed(3)}</sup>
                &nbsp;&nbsp; R² = {result.regressionCL.rSquared.toFixed(4)}
                {result.regressionCL.slopeCI95 && (
                  <span className="text-slate-500 text-xs ml-2">
                    [b CI: {result.regressionCL.slopeCI95[0].toFixed(3)}, {result.regressionCL.slopeCI95[1].toFixed(3)}]
                  </span>
                )}
              </div>
            </div>
          )}
          {result.regressionVss && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Vss Regression</p>
              <div className="equation-block font-mono text-sm">
                Vss = {result.regressionVss.a.toExponential(3)} × BW
                <sup>{result.regressionVss.slope.toFixed(3)}</sup>
                &nbsp;&nbsp; R² = {result.regressionVss.rSquared.toFixed(4)}
              </div>
            </div>
          )}

          {/* Half-life */}
          {result.predictedHalfLife_human !== undefined && (
            <div className="bg-indigo-50 rounded p-2 text-sm">
              Predicted human t<sub>1/2</sub> = <strong>{formatNumber(result.predictedHalfLife_human)} h</strong>
              <span className="text-xs text-slate-500 ml-2">(0.693 × Vss / CL)</span>
            </div>
          )}

          {/* Back-predictions table */}
          {result.backPredictions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-600">Back-Predictions</p>
                <button
                  onClick={() => exportCSV(
                    result.backPredictions.map(bp => ({
                      species: bp.label,
                      BW_kg: bp.bodyWeight_kg,
                      CL_obs: bp.CL_observed ?? '',
                      CL_pred: bp.CL_predicted ?? '',
                      CL_PE: bp.CL_PE_pct !== undefined ? bp.CL_PE_pct.toFixed(1) + '%' : '',
                      CL_FE: bp.CL_foldError ?? '',
                      Vss_obs: bp.Vss_observed ?? '',
                      Vss_pred: bp.Vss_predicted ?? '',
                    })),
                    `${result.method}-backpredictions.csv`
                  )}
                  className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                >
                  <Download size={12} /> CSV
                </button>
              </div>
              <table className="sci-table">
                <thead>
                  <tr>
                    <th>Species</th>
                    <th>BW (kg)</th>
                    <th>CL obs</th>
                    <th>CL pred</th>
                    <th>PE%</th>
                    <th>Fold</th>
                    <th>Vss obs</th>
                    <th>Vss pred</th>
                    <th>Vss PE%</th>
                  </tr>
                </thead>
                <tbody>
                  {result.backPredictions.map(bp => (
                    <tr key={bp.label}>
                      <td className="font-medium">{bp.label}</td>
                      <td className="text-right font-mono">{bp.bodyWeight_kg}</td>
                      <td className="text-right font-mono">{formatNumber(bp.CL_observed)}</td>
                      <td className="text-right font-mono">{formatNumber(bp.CL_predicted)}</td>
                      <td className="text-right font-mono">
                        {bp.CL_PE_pct !== undefined ? (
                          <span className={Math.abs(bp.CL_PE_pct) <= 50 ? 'text-green-700' : 'text-red-600'}>
                            {bp.CL_PE_pct.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-center"><FoldErrorBadge fe={bp.CL_foldError} /></td>
                      <td className="text-right font-mono">{formatNumber(bp.Vss_observed)}</td>
                      <td className="text-right font-mono">{formatNumber(bp.Vss_predicted)}</td>
                      <td className="text-right font-mono">
                        {bp.Vss_PE_pct !== undefined ? `${bp.Vss_PE_pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-method warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className={`warn-${w.severity} border rounded px-2 py-1 text-xs`}>
                  {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AllometryResults({ results, inputs }: Props) {
  function exportRanking() {
    exportCSV(
      results.methodRanking.map(r => ({
        Method: r.label,
        'Predicted CL (mL/min)': r.predictedCL ?? '',
        'Predicted Vss (L)': r.predictedVss ?? '',
        'AAFE CL': r.AAFE_CL?.toFixed(3) ?? '',
        'Rank CL': r.rank_CL ?? '',
      })),
      'allometry-method-ranking.csv'
    );
  }

  if (results.methodResults.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No results yet. Configure inputs and click <strong>Run</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary ranking table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Method Ranking Summary</h3>
          <button onClick={exportRanking} className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600">
            <Download size={13} /> Export ranking
          </button>
        </div>
        <table className="sci-table text-xs">
          <thead>
            <tr>
              <th>Rank (CL)</th>
              <th>Method</th>
              <th>Human CL (mL/min)</th>
              <th>Human Vss (L)</th>
              <th>AAFE (CL)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {results.methodRanking.map(r => (
              <tr key={r.method}>
                <td className="text-center font-bold text-indigo-700">{r.rank_CL ?? '—'}</td>
                <td className="font-medium">{r.label}</td>
                <td className="text-right font-mono">{formatNumber(r.predictedCL)}</td>
                <td className="text-right font-mono">{formatNumber(r.predictedVss)}</td>
                <td className="text-right font-mono">
                  {r.AAFE_CL !== undefined ? (
                    <span className={r.AAFE_CL <= 2 ? 'text-green-700 font-semibold' : r.AAFE_CL <= 3 ? 'text-yellow-700' : 'text-red-600'}>
                      {r.AAFE_CL.toFixed(3)}
                    </span>
                  ) : '—'}
                </td>
                <td className="text-slate-500 italic text-[11px]">{r.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-method expandable details */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Detailed Results by Method</h3>
        {results.methodResults.map(r => (
          <MethodResult key={r.method} result={r} />
        ))}
      </div>
    </div>
  );
}
