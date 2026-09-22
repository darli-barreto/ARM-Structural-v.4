export const REGISTRY_VERSION = '2026-09-20.1';
export const STANDARD_IDS = ['E.020', 'E.030', 'E.050', 'E.060'] as const;
export type StandardId = typeof STANDARD_IDS[number];

export interface NormativeEdition {
  readonly id: string;
  readonly standard: StandardId;
  readonly title: string;
  readonly reference: string;
  readonly url: string;
  readonly review: 'pending';
  readonly limitation: string;
}

// Documentary candidates, not a declaration of applicability or a reviewed calculation engine.
export const EDITIONS: readonly NormativeEdition[] = [
  {id:'E020-2006',standard:'E.020',title:'Cargas / texto RNE 2006',reference:'DS 011-2006-VIVIENDA',url:'https://cdn.www.gob.pe/uploads/document/file/2366640/50%20E.020%20CARGAS.pdf',review:'pending',limitation:'Catalogo por uso, notas y excepciones pendientes de revision integral.'},
  {id:'E030-2026',standard:'E.030',title:'Diseno Sismorresistente / 2026',reference:'RM 183-2026-VIVIENDA',url:'https://www.gob.pe/institucion/vivienda/normas-legales/8081915-183-2026-vivienda',review:'pending',limitation:'Anexo tecnico completo pendiente de revision. Sin coeficientes sismicos habilitados.'},
  {id:'E030-2018-2019',standard:'E.030',title:'Diseno Sismorresistente / 2018-2019',reference:'RM 355-2018 y RM 043-2019-VIVIENDA',url:'https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne',review:'pending',limitation:'Edicion anterior candidata: requiere acreditar aplicabilidad de la disposicion transitoria; no se selecciona por fecha automaticamente.'},
  {id:'E050-2018',standard:'E.050',title:'Suelos y Cimentaciones / 2018',reference:'RM 406-2018-VIVIENDA',url:'https://cdn.www.gob.pe/uploads/document/file/2366655/54%20E.050%20SUELOS%20Y%20CIMENTACIONES%20RM%20N%C2%B0%20406-2018-VIVIENDA.pdf',review:'pending',limitation:'Revision integral y verificaciones geotecnicas pendientes.'},
  {id:'E060-2009',standard:'E.060',title:'Concreto Armado / 2009',reference:'DS 010-2009-VIVIENDA',url:'https://cdn.www.gob.pe/uploads/document/file/2686419/E.060%20Concreto%20Armado%20DS%20N%C2%B0%20010-2009.pdf',review:'pending',limitation:'Referencias parciales de 9.2.1 y 9.2.3; no hay diseno ni combinaciones normativas habilitadas en el solver.'},
];

export const TRANSITION_SOURCE = {
  reference:'RM 217-2026-VIVIENDA / disposicion transitoria E.030',
  url:'https://www.gob.pe/institucion/vivienda/normas-legales/8219609-217-2026-vivienda',
};

export interface RequirementDefinition {
  readonly id: string;
  readonly standard: StandardId;
  readonly title: string;
  readonly article: string;
  readonly requiredInputs: readonly string[];
  readonly implementation: 'pending' | 'available';
  readonly validation: 'pending' | 'reviewed';
  readonly engineVersion: string;
  readonly criterion?: {readonly unit:string;readonly operator:'<='|'>=';readonly editionId:string};
}

export const REQUIREMENTS: readonly RequirementDefinition[] = [
  {id:'E020-LOADS',standard:'E.020',title:'Cargas por uso y balance de peso',article:'Tabla 1 y arts. 3-7; matriz completa pendiente',requiredInputs:['occupancy','loadLedger'],implementation:'pending',validation:'pending',engineVersion:'not-implemented'},
  {id:'E030-SEISMIC',standard:'E.030',title:'Analisis y verificaciones sismicas',article:'Articulos pendientes de matriz por edicion',requiredInputs:['site','soil','massSource','seismicResults'],implementation:'pending',validation:'pending',engineVersion:'not-implemented'},
  {id:'E050-FOUNDATIONS',standard:'E.050',title:'Suelo y cimentaciones',article:'Matriz de articulos pendiente',requiredInputs:['geotechnicalStudy','foundationResults'],implementation:'pending',validation:'pending',engineVersion:'not-implemented'},
  {id:'E060-COMBINATIONS',standard:'E.060',title:'Combinaciones de acciones',article:'9.2; referencias parciales 9.2.1 y 9.2.3',requiredInputs:['actionInventory','combinationResults'],implementation:'pending',validation:'pending',engineVersion:'not-implemented'},
  {id:'E060-DESIGN',standard:'E.060',title:'Resistencia, servicio y detallado',article:'9.1 y requisitos por elemento/sistema; matriz pendiente',requiredInputs:['system','designResults','detailing'],implementation:'pending',validation:'pending',engineVersion:'not-implemented'},
];

export function findEdition(id: string | null): NormativeEdition | undefined {
  return EDITIONS.find(edition => edition.id === id);
}
