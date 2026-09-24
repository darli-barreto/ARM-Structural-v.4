import { defaultNormativeProfile, type NormativeProfile } from '../../core/normative/Profile';

export interface NormativeProjectContext {
  projectId: string;
  modelRevision: number;
}

export interface NormativePanelSnapshot {
  open: boolean;
  profile: NormativeProfile;
  context: NormativeProjectContext;
}

const initialSnapshot: NormativePanelSnapshot = {
  open: false,
  profile: defaultNormativeProfile(),
  context: { projectId: '', modelRevision: 0 },
};

let snapshot = initialSnapshot;
let commitProfile: ((profile: NormativeProfile) => NormativeProfile) | null = null;
let getProjectContext: (() => NormativeProjectContext) | null = null;
const listeners = new Set<() => void>();

function publish(next: NormativePanelSnapshot): void {
  snapshot = next;
  listeners.forEach(listener => listener());
}

export const normativePanelStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  getServerSnapshot() {
    return initialSnapshot;
  },
  open(
    profile: NormativeProfile,
    context: NormativeProjectContext,
    commit: (profile: NormativeProfile) => NormativeProfile,
    currentContext: () => NormativeProjectContext,
  ) {
    commitProfile = commit;
    getProjectContext = currentContext;
    publish({ open: true, profile: structuredClone(profile), context: { ...context } });
  },
  close() {
    if (snapshot.open) publish({ ...snapshot, open: false });
  },
  commit(profile: NormativeProfile): NormativeProfile {
    if (!commitProfile) throw new Error('El controlador de proyecto no está disponible.');
    const saved = structuredClone(commitProfile(profile));
    publish({ ...snapshot, profile: saved });
    return saved;
  },
  getCurrentContext(): NormativeProjectContext {
    return getProjectContext?.() ?? snapshot.context;
  },
};
