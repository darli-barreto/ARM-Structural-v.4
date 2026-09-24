'use client';

import { useEffect } from 'react';
import { structuralApplicationLifecycle } from '@/features/application/StructuralApplicationLifecycle.ts';

export default function StructuralEngineMount({ onError }: { onError: (message: string) => void }) {
  useEffect(() => {
    let mounted = true;
    const lease = structuralApplicationLifecycle.acquire(async () => {
      const { startStructuralApplication } = await import('@/main');
      return startStructuralApplication();
    });
    void lease.ready.catch((cause: unknown) => {
      if (mounted) onError(cause instanceof Error ? cause.message : 'Error al iniciar el modelador.');
    });
    return () => { mounted = false; lease.release(); };
  }, [onError]);

  return null;
}
