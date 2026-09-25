import type { Frame2dResultV1 } from '../../kernel/worker/frame2d.protocol';
import { kernelDiagnosticRows, kernelDiagnosticsScope, kernelDiagnosticsUnavailable } from '../../core/analysis/KernelDiagnostics';

export function KernelDiagnosticsView({ diagnostics }: { diagnostics: Frame2dResultV1['diagnostics'] }) {
  const rows = kernelDiagnosticRows(diagnostics);
  return <details className="mt-2 border-t border-slate-200 pt-2" data-testid="kernel-diagnostics">
    <summary className="cursor-pointer font-medium">Diagnóstico numérico Rust</summary>
    <p className="mt-2 text-slate-600">{kernelDiagnosticsScope}</p>
    {rows.length ? <dl className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
      {rows.map(row => <div key={row.label} className="min-w-0 border-l-2 border-slate-200 pl-3">
        <dt className="font-medium">{row.label}</dt>
        <dd className="break-words font-mono">{row.value}</dd>
        <dd className="mt-1 text-slate-600">{row.explanation}</dd>
      </div>)}
    </dl> : <p className="mt-2 text-amber-800">{kernelDiagnosticsUnavailable}</p>}
  </details>;
}
