'use client';

import { useSyncExternalStore } from 'react';

const query = '(max-width: 767px)';

function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

export function useMobileViewerMode() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
