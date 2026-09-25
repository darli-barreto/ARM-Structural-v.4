import { useState } from 'react';
import { KernelDiagnosticsView } from './KernelDiagnosticsView';
import { benchmarkChecks, benchmarkMatches, benchmarkSource } from '@/core/analysis/Benchmarks';
import { assessAnalysisResult, type AssessmentState } from '@/core/analysis/ResultAssessment';
import type { AnalysisPanelSnapshot } from './AnalysisPanelStore';
import type { KernelParityReport } from '@/core/analysis/KernelAdapter';

const tableClasses = 'w-full border-collapse text-left text-xs [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:border-b [&_td]:border-slate-200 [&_td]:p-2';
const stateText: Record<AssessmentState, string> = {
  coherent: 'Coherente', review: 'Revisar', unverified: 'No verificado',
};
const stateClasses: Record<AssessmentState, string> = {
  coherent: 'text-emerald-800', review: 'text-rose-800', unverified: 'text-amber-800',
};

interface ComparisonRow {
  label: string;
  meaning: string;
  arm: number;
  rust: number;
  error: number;
  tolerance: number;
  unit: string;
  passed: boolean;
}

interface ComparisonGroup {
  title: string;
  explanation: string;
  count: number;
  failures: number;
  unavailable: boolean;
  buildRows(): ComparisonRow[];
}

function comparisonGroup<Row extends { passed: boolean }>(
  title: string,
  explanation: string,
  source: readonly Row[],
  convert: (row: Row) => ComparisonRow,
  unavailable = false,
): ComparisonGroup {
  return {
    title, explanation, count: source.length, unavailable,
    failures: source.filter(row => !row.passed).length,
    buildRows: () => source.map(convert),
  };
}

function comparisonGroups(report: KernelParityReport): ComparisonGroup[] {
  return [
    comparisonGroup(
      'Nudos y reacciones',
      'Traslaciones y giro describen movimiento; reacciones son las fuerzas necesarias para imponer los apoyos. Un signo negativo indica el sentido del eje, no un error.',
      report.rows, row => ({
        label: `${row.nodeId} / ${row.quantity}`,
        meaning: ({ ux: 'Desplazamiento horizontal', uy: 'Desplazamiento vertical', rotation: 'Giro nodal', rx: 'Reacción horizontal', ry: 'Reacción vertical', rm: 'Momento de reacción' })[row.quantity],
        arm: row.reference, rust: row.kernel, error: row.absoluteError, tolerance: row.tolerance, passed: row.passed,
        unit: row.quantity === 'ux' || row.quantity === 'uy' ? 'm' : row.quantity === 'rotation' ? 'rad' : row.quantity === 'rm' ? 'kN·m' : 'kN',
      }),
    ),
    comparisonGroup(
      'Fuerzas de extremo',
      'N, V y M en los extremos I/J son acciones internas locales. Diferir aquí puede señalar unidades, ejes, liberaciones o ensamblaje distintos.',
      report.memberRows, row => ({
        label: `${row.memberId} / ${row.component}`,
        meaning: row.component.startsWith('fx') ? 'Axial local' : row.component.startsWith('fy') ? 'Cortante local' : 'Momento local',
        arm: row.reference, rust: row.kernel, error: row.absoluteError, tolerance: row.tolerance, passed: row.passed,
        unit: row.component.startsWith('mz') ? 'kN·m' : 'kN',
      }),
    ),
    comparisonGroup(
      'Diagramas a lo largo de cada barra',
      'N, V y M se muestrean por estación. Una discrepancia interior con extremos iguales apunta a la recuperación del diagrama o a cargas distribuidas.',
      report.diagramRows, row => ({
        label: `${row.memberId} / ${row.quantity} / ${row.stationM.toFixed(3)} m`,
        meaning: row.quantity === 'axial' ? 'Fuerza axial' : row.quantity === 'shear' ? 'Fuerza cortante' : 'Momento flector',
        arm: row.reference, rust: row.kernel, error: row.absoluteError, tolerance: row.tolerance, passed: row.passed,
        unit: row.quantity === 'moment' ? 'kN·m' : 'kN',
      }),
    ),
    comparisonGroup(
      'Deformada entre nudos',
      'Desplazamientos X/Y por estación, con flexión y corte Timoshenko. Igualdad en los extremos no basta: también debe coincidir la curva interior.',
      report.deformationRows, row => ({
        label: `${row.memberId} / ${row.quantity === 'deflectionX' ? 'δX' : 'δY'} / ${row.stationM.toFixed(3)} m`,
        meaning: row.quantity === 'deflectionX' ? 'Desplazamiento horizontal' : 'Desplazamiento vertical',
        arm: row.reference * 1_000, rust: row.kernel * 1_000, error: row.absoluteError * 1_000, tolerance: row.tolerance * 1_000, passed: row.passed,
        unit: 'mm',
      }), !report.deformationAvailable,
    ),
  ];
}

function ComparisonGroupView({ group }: { group: ComparisonGroup }) {
  const [expanded, setExpanded] = useState(group.failures > 0 || group.unavailable);
  return <details className="mt-2 border-t border-slate-200 pt-2" open={expanded}
    onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer font-medium">{group.title} · {group.unavailable ? 'incompleto' : group.failures ? `${group.failures} incongruentes / ${group.count}` : `${group.count} coinciden`}</summary>
    <p className="mt-1 text-slate-600">{group.explanation}</p>
    {group.unavailable ? <p className="mt-1 text-rose-800">Rust no devolvió la curva completa; el contraste global no puede aprobarse.</p>
      : expanded ? <ComparisonTable rows={group.buildRows()} /> : null}
  </details>;
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const ordered = [...rows.filter(row => !row.passed), ...rows.filter(row => row.passed)];
  return <>
    <div className="mt-2 max-h-64 max-w-full overflow-auto">
      <table className={tableClasses}><thead><tr><th>Referencia</th><th>Interpretación</th><th>ARM</th><th>Rust</th><th>|Δ|</th><th>Tolerancia</th><th>Lectura</th></tr></thead><tbody>
        {ordered.slice(current * pageSize, (current + 1) * pageSize).map((row, index) => <tr key={`${row.label}-${index}`}>
          <td className="whitespace-nowrap">{row.label}</td><td>{row.meaning}</td>
          <td>{row.arm.toExponential(3)} {row.unit}</td><td>{row.rust.toExponential(3)} {row.unit}</td>
          <td>{row.error.toExponential(2)} {row.unit}</td><td>{row.tolerance.toExponential(2)} {row.unit}</td>
          <td className={row.passed ? stateClasses.coherent : stateClasses.review}>{row.passed ? 'Coincide' : 'Incongruente'}</td>
        </tr>)}
      </tbody></table>
    </div>
    <PageControls page={current} pages={pages} total={ordered.length} onPage={setPage} />
  </>;
}

function PageControls({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <div className="mt-1 flex items-center justify-end gap-2 text-slate-600">
    <span>{total} registros · página {page + 1} de {pages}</span>
    <button type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</button>
    <button type="button" aria-label="Página siguiente" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
  </div>;
}

export function AnalysisResultsView({ panel }: { panel: AnalysisPanelSnapshot }) {
  const [nodePage, setNodePage] = useState(0);
  const [memberPage, setMemberPage] = useState(0);
  const { model, result, kernelReport } = panel;
  if (!model || !result) return null;
  const assessment = assessAnalysisResult(model, result, panel.factors, panel.benchmark, kernelReport);
  const issues = assessment.filter(item => item.state === 'review').length;
  const prominent = assessment.filter(item => item.state === 'review' || (!item.label.startsWith('Nudo ') && !item.label.startsWith('Barra ')));
  const nodePages = Math.max(1, Math.ceil(result.nodes.length / 50));
  const memberPages = Math.max(1, Math.ceil(result.members.length / 50));
  const currentNodePage = Math.min(nodePage, nodePages - 1);
  const currentMemberPage = Math.min(memberPage, memberPages - 1);
  const nodeInputs = new Map(model.nodes.map(node => [node.id, node]));
  const memberInputs = new Map(model.members.map(member => [member.id, member]));
  const assessmentByLabel = new Map(assessment.map(item => [item.label, item]));
  const benchmarkApplicable = panel.benchmark && !panel.stale && benchmarkMatches(panel.benchmark, model, panel.factors);
  const benchmarkRows = benchmarkApplicable && panel.benchmark ? benchmarkChecks(panel.benchmark, result) : [];
  const benchmarkPassed = benchmarkRows.length > 0 && benchmarkRows.every(row => row.pass);

  return <div className="space-y-2 p-2 text-xs">
    <section className="border-b border-slate-200 pb-2" aria-label="Lectura técnica del cálculo">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Lectura técnica del cálculo</h3><strong className={issues ? stateClasses.review : stateClasses.coherent}>{issues ? `${issues} observaciones para revisar` : 'Sin incongruencias internas detectadas'}</strong></div>
      <p className="my-1 text-slate-600">Coherente significa que pasó las comprobaciones indicadas, no que cumpla límites de servicio, resistencia ni el RNE.</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {prominent.map(item => <div key={item.label} className="border-l-2 border-slate-200 py-1 pl-2">
          <div className="flex flex-wrap gap-2"><strong>{item.label}</strong><span className={stateClasses[item.state]}>{stateText[item.state]}</span></div>
          <p className="text-slate-600">{item.explanation}</p>
        </div>)}
      </div>
    </section>

    {panel.benchmark && <details className="border-b border-slate-200 pb-2" open={model.nodes.length <= 10}>
      <summary className="cursor-pointer font-semibold">Referencia analítica independiente</summary>
      {!benchmarkApplicable
        ? <p className="benchmark-note mt-2 text-amber-800">Modelo modificado. La solución cerrada original no aplica a estos datos.</p>
        : <section className="benchmark-comparison mt-2">
          <h3 className={benchmarkPassed ? stateClasses.coherent : stateClasses.review}>{benchmarkPassed ? 'Coincide con la referencia' : 'Fuera de tolerancia'}</h3>
          <p className="mt-1 text-slate-600">{panel.benchmark === 'cantilever' ? 'Voladizo Timoshenko' : 'Viga biapoyada'} · tolerancia 1e-6 relativa + 1e-8 absoluta en la unidad de cada fila.</p>
          <div className="mt-2 max-w-full overflow-auto"><table className={`${tableClasses} min-w-[600px]`}><thead><tr><th>Magnitud y fórmula</th><th>Esperado</th><th>ARM</th><th>|Error|</th><th>Estado</th></tr></thead><tbody>
            {benchmarkRows.map(row => <tr key={row.label}>
              <td className="min-w-48 max-w-64 whitespace-normal break-words"><strong>{row.label} ({row.unit})</strong><small className="mt-1 block text-slate-500">{row.formula}</small></td>
              <td>{row.expected.toFixed(6)}</td><td>{row.actual?.toFixed(6) ?? '—'}</td><td>{row.error?.toExponential(2) ?? '—'}</td>
              <td className={row.pass ? stateClasses.coherent : stateClasses.review}>{row.pass ? 'Coincide' : 'Revisar'}</td>
            </tr>)}
          </tbody></table></div>
          <p className="mt-1 text-slate-600">{panel.benchmark === 'cantilever'
            ? <><a className="underline" href={benchmarkSource} target="_blank" rel="noopener noreferrer">Referencia Timoshenko / TU Delft</a>. Geometría y material son propios del ensayo.</>
            : 'Solución cerrada por equilibrio de viga con carga uniforme.'} No es certificación normativa.</p>
        </section>}
    </details>}

    <section className="border-b border-slate-200 pb-2" aria-label="Comparación ARM y Structural Kernel">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Comparación ARM / Rust</h3><span role="status" aria-live="polite">{panel.kernelMessage || (panel.kernelAvailable ? 'Pendiente: ejecute Contrastar Rust con este resultado vigente.' : 'Motor Rust no disponible en esta sesión.')}</span></div>
      <p className="text-slate-600">Se comparan los mismos nudos, cargas y secciones con la tolerancia |Δ| ≤ 1e-8 + 1e-6 × |ARM|, en la unidad interna de cada magnitud. La paridad no demuestra que ambos modelos sean correctos.</p>
      {kernelReport && <KernelDiagnosticsView diagnostics={kernelReport.diagnostics} />}
      {kernelReport && comparisonGroups(kernelReport).map(group =>
        <ComparisonGroupView key={group.title} group={group} />)}
    </section>

    <details className="border-b border-slate-200 pb-2" open={result.nodes.length <= 8}>
      <summary className="cursor-pointer font-semibold">Desplazamientos y reacciones · {result.nodes.length} nudos</summary>
      <p className="mt-1 text-slate-600">Uh/Uy: movimiento en los ejes del plano; giro: rotación. Rh/Ry/Rm: respuestas de los apoyos. Los signos indican dirección y las magnitudes requieren revisión de límites aplicables.</p>
      <div className="mt-2 max-h-72 max-w-full overflow-auto"><table className={tableClasses}><thead><tr><th>Nudo</th><th>Uh (mm)</th><th>Uy (mm)</th><th>Giro (rad)</th><th>Rh (kN)</th><th>Ry (kN)</th><th>Rm (kN·m)</th><th>Lectura</th></tr></thead><tbody>
        {result.nodes.slice(currentNodePage * 50, (currentNodePage + 1) * 50).map(node => {
          const support = nodeInputs.get(node.id)?.support;
          const check = assessmentByLabel.get(`Nudo ${node.id} / ${support}`);
          const meaning = support === 'fixed' ? 'Empotrado: Ux, Uy y giro restringidos.'
            : support === 'pinned' ? 'Articulado: Ux y Uy restringidos; giro libre.'
              : support === 'roller' ? 'Rodillo: Uy restringido; Ux y giro libres.'
                : 'Libre: sin reacciones impuestas.';
          return <tr key={node.id}><td>{node.id}</td><td>{(node.ux * 1_000).toFixed(4)}</td><td>{(node.uy * 1_000).toFixed(4)}</td><td>{node.rotation.toExponential(3)}</td><td>{node.rx.toFixed(3)}</td><td>{node.ry.toFixed(3)}</td><td>{node.rm.toFixed(3)}</td><td><span className={check ? stateClasses[check.state] : stateClasses.review}>{check ? stateText[check.state] : 'Revisar'}</span><small className="block min-w-40 text-slate-500">{check?.state === 'review' ? check.explanation : meaning}</small></td></tr>;
        })}
      </tbody></table></div>
      <PageControls page={currentNodePage} pages={nodePages} total={result.nodes.length} onPage={setNodePage} />
    </details>

    <details className="pb-2" open={result.members.length <= 8}>
      <summary className="cursor-pointer font-semibold">Demandas internas · {result.members.length} barras</summary>
      <p className="mt-1 text-slate-600">|N|, |V| y |M| son máximos absolutos del caso en las estaciones muestreadas; no incluyen combinación envolvente ni comprobación de capacidad E.060.</p>
      <div className="mt-2 max-h-72 max-w-full overflow-auto"><table className={tableClasses}><thead><tr><th>Barra</th><th>|N|max (kN)</th><th>|V|max (kN)</th><th>|M|max (kN·m)</th><th>Lectura</th></tr></thead><tbody>
        {result.members.slice(currentMemberPage * 50, (currentMemberPage + 1) * 50).map(member => {
          const mark = memberInputs.get(member.id)?.mark ?? member.id;
          const check = assessmentByLabel.get(`Barra ${mark} (${member.id})`);
          return <tr key={member.id}><td>{mark}</td><td>{Math.max(...member.axial.map(Math.abs)).toFixed(3)}</td><td>{Math.max(...member.shear.map(Math.abs)).toFixed(3)}</td><td>{Math.max(...member.moment.map(Math.abs)).toFixed(3)}</td><td><span className={check ? stateClasses[check.state] : stateClasses.review}>{check ? stateText[check.state] : 'Revisar'}</span><small className="block min-w-40 text-slate-500">{check?.state === 'review' ? check.explanation : 'Demanda del caso; capacidad no verificada.'}</small></td></tr>;
        })}
      </tbody></table></div>
      <PageControls page={currentMemberPage} pages={memberPages} total={result.members.length} onPage={setMemberPage} />
    </details>
  </div>;
}
