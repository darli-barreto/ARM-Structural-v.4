'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Download, Save, X } from 'lucide-react';
import { parseNormativeProfile, type NormativeProfile } from '@/core/normative/Profile';
import { EDITIONS, REGISTRY_VERSION, REQUIREMENTS, STANDARD_IDS, TRANSITION_SOURCE, type StandardId } from '@/core/normative/Registry';
import { normativeMatrix, normativeReport, STATUS_LABELS } from '@/core/normative/Verification';
import { download } from '@/shared/ui/dom.ts';
import { normativePanelStore } from '@/features/normative/NormativePanelStore.ts';
import { useMobileViewerMode } from '@/shared/ui/useMobileViewerMode.ts';

function updateSelection<K extends 'editionId' | 'justification' | 'evidenceReference'>(
  profile: NormativeProfile,
  standard: StandardId,
  key: K,
  value: NormativeProfile['selections'][StandardId][K],
): NormativeProfile {
  return {
    ...profile,
    selections: {
      ...profile.selections,
      [standard]: { ...profile.selections[standard], [key]: value },
    },
  };
}

export default function NormativePanel() {
  const panel = useSyncExternalStore(normativePanelStore.subscribe, normativePanelStore.getSnapshot, normativePanelStore.getServerSnapshot);
  const mobileViewer = useMobileViewerMode();
  const [draft, setDraft] = useState(panel.profile);
  const [status, setStatus] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const scopeRef = useRef<HTMLTextAreaElement>(null);
  const checks = useMemo(() => normativeMatrix(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(panel.profile);

  useEffect(() => {
    if (panel.open && !wasOpen.current) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDraft(structuredClone(panel.profile));
      setStatus('');
      requestAnimationFrame(() => mobileViewer ? document.getElementById('normative-close')?.focus() : scopeRef.current?.focus());
    } else if (!panel.open && wasOpen.current) {
      previousFocus.current?.focus();
      previousFocus.current = null;
    }
    wasOpen.current = panel.open;
  }, [mobileViewer, panel.open, panel.profile]);

  const close = () => normativePanelStore.close();
  const changeDraft = (next: NormativeProfile) => {
    setDraft(next);
    setStatus('Cambios sin guardar');
  };

  const save = () => {
    try {
      const saved = normativePanelStore.commit(parseNormativeProfile(draft));
      setDraft(saved);
      setStatus('Perfil guardado. Verificación pendiente.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo guardar el perfil.');
    }
  };

  const exportMatrix = () => {
    const context = normativePanelStore.getCurrentContext();
    download(JSON.stringify(normativeReport(panel.profile, context.projectId, context.modelRevision), null, 2), 'matriz-rne.json');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
    )).filter(control => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!panel.open) return null;

  return <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-0 md:items-center md:p-5" role="presentation" onKeyDown={handleKeyDown} onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
    <section id="normative-modal" className="normative-dialog flex max-h-[88dvh] w-full max-w-5xl touch-pan-y flex-col overflow-hidden rounded-t-lg border border-slate-300 bg-white text-slate-800 max-md:[&_input]:pointer-events-none max-md:[&_input]:opacity-60 max-md:[&_select]:pointer-events-none max-md:[&_select]:opacity-60 max-md:[&_textarea]:pointer-events-none max-md:[&_textarea]:opacity-60 [&_input]:min-w-0 [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-2 [&_input]:py-1 [&_select]:min-w-0 [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-2 [&_select]:py-1 [&_textarea]:min-w-0 [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:bg-white [&_textarea]:p-2 md:max-h-[94dvh] md:rounded-none" role="dialog" aria-modal="true" aria-labelledby="normative-heading">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div><span className="text-xs font-semibold">PERÚ / RNE</span><h2 id="normative-heading" className="text-lg font-semibold">Perfil normativo</h2></div>
        <button id="normative-close" type="button" className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 hover:bg-slate-100" title="Cerrar" aria-label="Cerrar" onClick={close}><X aria-hidden="true" className="h-4 w-4" /></button>
      </header>
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">Aplicabilidad pendiente de revisión profesional. Sin comprobación integral del RNE.</div>
      <fieldset className="contents" disabled={mobileViewer}><div className="normative-body min-h-0 overflow-auto p-3">
        <label className="mb-3 flex flex-col gap-1 text-xs">Alcance del proyecto<textarea ref={scopeRef} className="w-full" id="normative-scope" rows={2} maxLength={4000} value={draft.scope} onChange={event => changeDraft({ ...draft, scope: event.currentTarget.value })} /></label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {STANDARD_IDS.map(standard => {
            const selection = draft.selections[standard];
            const edition = EDITIONS.find(item => item.id === selection.editionId);
            return <fieldset key={standard} className="flex min-w-0 flex-col gap-2 border-t border-slate-300 py-3 text-xs" data-standard={standard}>
              <legend>{standard}</legend>
              <label className="flex flex-col gap-1">Edición propuesta<select className="w-full" data-edition aria-label={`Edición ${standard}`} value={selection.editionId ?? ''} onChange={event => changeDraft(updateSelection(draft, standard, 'editionId', event.currentTarget.value || null))}>
                <option value="">Sin definir</option>{EDITIONS.filter(item => item.standard === standard).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select></label>
              <label className="flex flex-col gap-1">Justificación de aplicabilidad<textarea className="w-full" data-justification aria-label={`Justificación ${standard}`} rows={2} maxLength={4000} value={selection.justification} onChange={event => changeDraft(updateSelection(draft, standard, 'justification', event.currentTarget.value))} /></label>
              <label className="flex flex-col gap-1">Referencia de evidencia<input className="w-full" data-evidence aria-label={`Evidencia ${standard}`} maxLength={4000} value={selection.evidenceReference} onChange={event => changeDraft(updateSelection(draft, standard, 'evidenceReference', event.currentTarget.value))} /></label>
              <div data-source>{edition ? <><a href={edition.url} target="_blank" rel="noopener noreferrer">{edition.reference}</a><p>{edition.limitation}</p></> : <p>Sin edición seleccionada.</p>}</div>
            </fieldset>;
          })}
        </div>
        <p className="border-b border-slate-200 py-3 text-xs [&_a]:break-words [&_a]:text-sky-800 [&_a]:underline"><a href={TRANSITION_SOURCE.url} target="_blank" rel="noopener noreferrer">{TRANSITION_SOURCE.reference}</a></p>
        <h3 className="my-3 text-sm font-semibold">Verificaciones pendientes</h3>
        <div id="normative-matrix" aria-live="polite">{checks.map(check => {
          const rule = REQUIREMENTS.find(item => item.id === check.requirementId)!;
          return <div key={rule.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-slate-200 py-2 text-xs [&_p]:col-span-full [&_p]:break-words" data-check={rule.id}>
            <div className="min-w-0 break-words"><strong>{rule.title}</strong><small className="mt-1 block text-slate-500">{rule.standard} / {rule.article}</small></div>
            <b className="normative-state text-right text-[11px] text-amber-800">{STATUS_LABELS[check.status]}</b>
            <p>{check.reason}</p>
          </div>;
        })}</div>
        <p className="mt-3 break-words text-[11px] text-slate-500">Registro {REGISTRY_VERSION} / Revisión del perfil <span id="normative-revision">{draft.revision}</span></p>
      </div></fieldset>
      <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-xs md:flex"><span id="normative-status" role="status" aria-live="polite">{status}</span><div className="flex items-center gap-2">
        <button id="normative-export" type="button" className="flex items-center gap-1.5 border border-slate-300 px-3 py-1.5 disabled:opacity-40" title="Exportar matriz guardada" disabled={dirty} onClick={exportMatrix}><Download aria-hidden="true" className="h-4 w-4" /> Matriz</button>
        <button id="normative-cancel" type="button" className="border border-slate-300 px-3 py-1.5 hover:bg-slate-50" onClick={close}>Cancelar</button>
        <button id="normative-save" type="button" className="flex items-center gap-1.5 border border-emerald-800 bg-emerald-800 px-3 py-1.5 text-white hover:bg-emerald-700" onClick={save}><Save aria-hidden="true" className="h-4 w-4" /> Guardar perfil</button>
      </div></footer>
    </section>
  </div>;
}
