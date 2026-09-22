import type { StructuralDefinition } from '../model/Geometry';

export type BimCategory =
  | 'OST_StructuralFoundation'
  | 'OST_StructuralColumns'
  | 'OST_StructuralFraming'
  | 'OST_Floors'
  | 'OST_Grids'
  | 'OST_Levels';

export interface BimTypeParameters {
  typeId?: string;
  typeName: string;
  category?: BimCategory;
  width?: number;
  depth?: number;
  height?: number;
  thickness?: number;
  defaultMaterial: string;
  concreteStrength: number; // f'c en kg/cm²
  unitCost: number; // USD por m³
  structuralRole: string;
}

export interface BimInstanceParameters {
  mark: string; // Código de elemento (ej. C-1, C-101, V-101, Z-1)
  sector: string; // Sector de vaciado (ej. Sector A, Sector B, Sector C)
  phase: 'Nueva Construcción' | 'Existente' | 'Demolición';
  baseLevel: string;
  topLevel?: string;
  baseOffset: number;
  topOffset?: number;
  length?: number;
  height?: number;
  volume: number; // m³
  grossVolume?:number;
  netVolume?:number;
  overlapVolume?:number;
  quantityState?:'pending'|'ready'|'error';
  deductedBy?:string[];
  steelMass?:number;
  surfaceArea: number; // Área de encofrado en m²
  concreteStrength: number; // f'c individual o heredado
  estimatedCost: number; // Calculado: volumen * unitCost
  comments?: string;
}

export interface BimElementDocument {
  reinforcement?:import('../model/Reinforcement').RebarSpec;
  _id: string; // MongoDB BSON _id (mapeado al UniqueId GUID)
  elementId: number; // Revit Element ID secuencial (ej. 100101)
  uniqueId: string; // Revit / OpenBIM IFC GUID (128-bit)
  category: BimCategory;
  categoryName: string;
  family: string;
  familyType: string;
  typeId: string;
  levelId: string;
  levelName: string;
  typeParameters: BimTypeParameters;
  instanceParameters: BimInstanceParameters;
  geometry: {
    definition: StructuralDefinition;
    origin: { x: number; y: number; z: number };
    dimensionsString: string;
    boundingBox?: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    software: string;
    ifcEntity: string; // ej. IfcColumn, IfcBeam, IfcFooting, IfcSlab
  };
}

export interface BimGridDocument {
  _id: string;
  elementId: number;
  uniqueId: string;
  category: 'OST_Grids';
  categoryName: 'Rejillas';
  family: 'Rejilla Estándar Circular 6.5mm';
  name: string;
  geomType: 'line' | 'arc';
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  length: number;
  showStartBubble?: boolean;
  showEndBubble?: boolean;
  isLocked?: boolean;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    software: string;
    ifcEntity: 'IfcGrid';
  };
}

export interface BimLevelDocument {
  _id: string;
  elementId: number;
  uniqueId: string;
  category: 'OST_Levels';
  categoryName: 'Niveles';
  family: 'Nivel con Cota 8mm';
  name: string;
  elevation: number;
  hasFloorPlan: boolean;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    software: string;
    ifcEntity: 'IfcBuildingStorey';
  };
}

export type BimAnyDocument = BimElementDocument | BimGridDocument | BimLevelDocument;

export interface GroupedScheduleRow {
  typeId: string;
  familyType: string;
  categoryName: string;
  category: BimCategory;
  count: number;
  levelNames: string[];
  sectors: string[];
  avgConcreteStrength: number;
  totalVolume: number;
  totalSurfaceArea: number;
  totalCost: number;
  guids: string[];
}

export interface ScheduleQueryOptions {
  category?: BimCategory | 'ALL';
  levelName?: string;
  sector?: string;
  search?: string;
  groupByType?: boolean;
}

export interface ScheduleSummary {
  totalCount: number;
  totalVolume: number;
  totalSurfaceArea: number;
  totalCost: number;
}
