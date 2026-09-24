import { test, expect } from 'bun:test';
import { defaultNormativeProfile, updateNormativeProfile } from '../src/core/normative/Profile';
import { normativePanelStore } from '../src/features/normative/NormativePanelStore';

test('El panel React recibe el perfil vigente, versiona el guardado y usa el contexto actual', () => {
  const initial = defaultNormativeProfile();
  let revision = 4;
  normativePanelStore.open(
    initial,
    { projectId: 'project-1', modelRevision: 3 },
    draft => updateNormativeProfile(initial, draft),
    () => ({ projectId: 'project-1', modelRevision: revision }),
  );
  expect(normativePanelStore.getSnapshot().open).toBe(true);
  expect(normativePanelStore.getSnapshot().profile).toEqual(initial);

  const draft = structuredClone(initial);
  draft.scope = 'Edificio de ensayo';
  const saved = normativePanelStore.commit(draft);
  expect(saved.revision).toBe(2);
  expect(normativePanelStore.getSnapshot().profile.scope).toBe('Edificio de ensayo');
  revision = 5;
  expect(normativePanelStore.getCurrentContext()).toEqual({ projectId: 'project-1', modelRevision: 5 });

  normativePanelStore.close();
  expect(normativePanelStore.getSnapshot().open).toBe(false);
});
