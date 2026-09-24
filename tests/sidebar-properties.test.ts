import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GridPropertiesPanel from '../src/features/properties/GridPropertiesPanel';
import LevelPropertiesPanel from '../src/features/properties/LevelPropertiesPanel';
import ElementPropertiesPanel from '../src/features/properties/ElementPropertiesPanel';
import type { ElementPropertiesSnapshot, GridPropertiesSnapshot, LevelPropertiesSnapshot } from '../src/features/properties/SidebarPropertiesStore';

test('La ficha React estructural conserva atributos editables y cantidades del documento BIM', () => {
  const element: ElementPropertiesSnapshot = {
    id: 'guid-beam', uniqueId: 'guid-beam', elementId: '10012', icon: '📏', familyType: 'Viga 30 x 60',
    categoryName: 'Armazón estructural', family: 'Viga de concreto', ifcEntity: 'IfcBeam', material: 'Concreto',
    unitCost: 125, mark: 'V-12', sector: 'Sector B', concreteStrength: 280, phase: 'Nueva Construcción',
    baseOffset: 0.15, levelName: 'Nivel 2', dimensions: '6.00 x 0.30 x 0.60 m', quantityState: 'ready',
    volume: 1.08, grossVolume: 1.12, overlapVolume: 0.04, steelMass: 42.5, surfaceArea: 7.56,
    estimatedCost: 135, category: 'OST_StructuralFraming',
  };

  const markup = renderToStaticMarkup(createElement(ElementPropertiesPanel, { element }));

  expect(markup).toContain('id="prop-input-mark"');
  expect(markup).toContain('value="V-12"');
  expect(markup).toContain('value="Sector B"');
  expect(markup).toContain('value="280"');
  expect(markup).toContain('value="0.15"');
  expect(markup).toContain('1.080 m³');
  expect(markup).toContain('42.50 kg');
  expect(markup).toContain('btn-prop-open-schedule');
  expect(markup).toContain('btn-delete-prop');
});

test('La ficha React de rejilla conserva geometría y controles de edición', () => {
  const grid: GridPropertiesSnapshot = {
    id: 'grid-a',
    uniqueId: 'guid-grid-a',
    elementId: 'G-12',
    name: 'A',
    family: 'Rejilla Estándar',
    geomType: 'arc',
    length: '18.25',
    radius: 5.8,
    showStartBubble: true,
    showEndBubble: false,
    isLocked: true,
    startElbowActive: false,
    endElbowActive: true,
  };

  const markup = renderToStaticMarkup(createElement(GridPropertiesPanel, { grid }));

  expect(markup).toContain('id="grid-name-input"');
  expect(markup).toContain('value="A"');
  expect(markup).toContain('18.25 m');
  expect(markup).toContain('5.80 m');
  expect(markup).toMatch(/<input[^>]*id="grid-prop-bubble-start"[^>]*checked=""/);
  expect(markup).toMatch(/<input[^>]*id="grid-prop-elbow-end"[^>]*checked=""/);
  expect(markup).toContain('id="btn-delete-grid-prop"');
});

test('La ficha React de nivel conserva cota, plano, cabezales y quiebres', () => {
  const level: LevelPropertiesSnapshot = {
    id: 'level-3',
    uniqueId: 'guid-level-3',
    elementId: 'L-3',
    name: 'Piso 2 (+7.50m)',
    shortName: 'Piso 2',
    elevation: 7.5,
    formattedElevation: '+7.50m',
    family: 'Nivel con Cota 8mm',
    hasPlanView: true,
    showStartBubble: false,
    showEndBubble: true,
    isLocked: false,
    startElbowActive: true,
    endElbowActive: false,
  };

  const markup = renderToStaticMarkup(createElement(LevelPropertiesPanel, { level }));

  expect(markup).toContain('id="lvl-name-input"');
  expect(markup).toContain('value="Piso 2"');
  expect(markup).toContain('value="7.50"');
  expect(markup).toContain('Asociada (Cabezal Azul)');
  expect(markup).toMatch(/<input[^>]*id="lvl-prop-bubble-end"[^>]*checked=""/);
  expect(markup).toMatch(/<input[^>]*id="lvl-prop-elbow-start"[^>]*checked=""/);
  expect(markup).toContain('id="btn-delete-lvl-prop"');
});
