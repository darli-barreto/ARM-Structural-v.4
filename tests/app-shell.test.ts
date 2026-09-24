import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppShell from '../src/features/application/AppShell';
import { sidebarPropertiesStore } from '../src/features/properties/SidebarPropertiesStore';

test('App Router renders the BIM shell and React components in their owned regions', () => {
  const markup = renderToStaticMarkup(createElement(AppShell, {
    ribbonTabs: createElement('span', { id: 'ribbon-react-content' }),
    ribbonPanels: createElement('span', { id: 'ribbon-panels-react-content' }),
    contextualBar: createElement('span', { id: 'contextual-react-content' }),
    sidebarNavigation: createElement('span', { id: 'sidebar-navigation-react-content' }),
    projectBrowser: createElement('span', { id: 'project-browser-react-content' }),
    workspace: createElement('span', { id: 'workspace-react-content' }),
    footerStatus: createElement('span', { id: 'footer-react-content' }),
    sidebarOpen: false,
    onCloseMobileSidebar: () => {},
  }));

  for (const id of [
    'app-root',
    'app-header',
    'react-ribbon-tabs-slot',
    'react-ribbon-panels-slot',
    'react-contextual-subbar-slot',
    'app-body',
    'app-sidebar',
    'sidebar-properties',
    'properties-content',
    'sidebar-browser',
    'react-project-browser-slot',
    'react-sidebar-nav-slot',
    'react-workspace-slot',
    'app-footer',
    'react-footer-slot',
  ]) {
    expect(markup).toContain(`id="${id}"`);
  }
  for (const id of [
    'ribbon-react-content',
    'ribbon-panels-react-content',
    'contextual-react-content',
    'sidebar-navigation-react-content',
    'project-browser-react-content',
    'workspace-react-content',
    'footer-react-content',
  ]) {
    expect(markup).toContain(`id="${id}"`);
  }
  expect(markup).toContain('Ningún elemento seleccionado');
});

test('El store de propiedades vuelve al estado vacío al deseleccionar', () => {
  sidebarPropertiesStore.setGrid({
    id: 'grid-1', uniqueId: null, elementId: '1', name: 'A', family: 'Rejilla', geomType: 'line',
    length: '6.00', radius: null, showStartBubble: true, showEndBubble: true, isLocked: false,
    startElbowActive: false, endElbowActive: false,
  });
  expect(sidebarPropertiesStore.getSnapshot().kind).toBe('grid');
  sidebarPropertiesStore.setEmpty();
  expect(sidebarPropertiesStore.getSnapshot().kind).toBe('empty');
});
