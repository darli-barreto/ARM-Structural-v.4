'use client';

import { useSyncExternalStore } from 'react';
import { footerStatusStore } from '@/features/footer-status/FooterStatusStore.ts';

export default function FooterStatus() {
  const status = useSyncExternalStore(
    footerStatusStore.subscribe,
    footerStatusStore.getSnapshot,
    footerStatusStore.getServerSnapshot
  );

  return (
    <div className="flex h-full w-full min-w-0 items-center justify-between gap-3">
      <div className="footer-left flex min-w-0 items-center gap-2">
        <div aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
        <span id="status-message" role="status" aria-live="polite" className="truncate font-sans text-slate-700">{status.message}</span>
      </div>
      <div id="status-metrics" className="footer-center hidden shrink-0 gap-4 text-slate-600 md:flex">
        <span>Elementos: <strong className="font-bold text-slate-900">{status.count}</strong></span>
        <span>Concreto: <strong className="font-bold text-slate-900">{status.volume.toFixed(2)} m³</strong></span>
        <span>Kernel: <strong className="font-bold text-slate-900">{status.calcMs.toFixed(2)} ms</strong></span>
        <span>FPS: <strong className="font-bold text-slate-900">{status.fps}</strong></span>
      </div>
      <div className="footer-right hidden shrink-0 gap-3 text-slate-500 md:flex">
        <span id="status-coords">{status.coordinates}</span>
      </div>
    </div>
  );
}
