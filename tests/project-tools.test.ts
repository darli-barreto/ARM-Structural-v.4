import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectTools from '../src/features/project/ProjectToolsView';
import { projectToolsStore } from '../src/features/project/ProjectToolsStore';

test('La barra de proyecto renderiza comandos React y publica el estado de guardado', () => {
  projectToolsStore.setStatus('Proyecto local');
  projectToolsStore.setReady(false);
  const markup = renderToStaticMarkup(createElement(ProjectTools, {
    sidebarOpen: false,
    onToggleSidebar: () => {},
  }));

  for (const id of ['project-save-status', 'project-sidebar', 'project-save', 'project-open', 'project-analysis', 'project-normative', 'project-file']) {
    expect(markup).toContain(`id="${id}"`);
  }
  expect(markup).toContain('Proyecto local');

  let notifications = 0;
  const unsubscribe = projectToolsStore.subscribe(() => { notifications += 1; });
  projectToolsStore.setStatus('Cambios pendientes');
  unsubscribe();
  expect(projectToolsStore.getSnapshot().status).toBe('Cambios pendientes');
  expect(notifications).toBe(1);
  projectToolsStore.setStatus('Proyecto local');
});
