import { BenchmarkId, benchmarkChecks, benchmarkMatches, benchmarkSource } from './Benchmarks';
import type { AnalysisModel, AnalysisResult, AnalysisSetup } from './Model';

export function benchmarkComparison(id:BenchmarkId,model:AnalysisModel,factors:AnalysisSetup['factors'],result?:AnalysisResult):string {
  if(!benchmarkMatches(id,model,factors))return '<p class="benchmark-note">Referencia modificada: la comparacion con el caso original no aplica.</p>';
  const rows=benchmarkChecks(id,result),pass=rows.every(r=>r.pass);
  const state=!result?'Pendiente de calcular':pass?'Coincide con la referencia':'Fuera de tolerancia';
  return `<section class="benchmark-comparison"><h3>${state}</h3><p>Referencia analitica / ${id==='cantilever'?'Voladizo Timoshenko':'Viga biapoyada'}. Tolerancia: 1e-6 relativa + 1e-8 absoluta. No es certificacion normativa.</p><div class="benchmark-scroll"><table><thead><tr><th>Magnitud</th><th>Esperado</th><th>Calculado</th><th>Error absoluto</th><th>Estado</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label} (${r.unit})<small>${r.formula}</small></td><td>${r.expected.toFixed(6)}</td><td>${r.actual===undefined?'-':r.actual.toFixed(6)}</td><td>${r.error===undefined?'-':r.error.toExponential(2)}</td><td>${r.pass===undefined?'-':r.pass?'OK':'Revisar'}</td></tr>`).join('')}</tbody></table></div>${id==='cantilever'?`<p><a href="${benchmarkSource}" target="_blank" rel="noopener noreferrer">Solucion cerrada Timoshenko / TU Delft</a>. Geometria y material propios del ensayo.</p>`:'<p>Solucion cerrada por equilibrio de una viga bajo carga uniforme.</p>'}</section>`;
}
