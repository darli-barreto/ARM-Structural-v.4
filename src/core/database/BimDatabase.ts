import {
  BimAnyDocument,
  BimCategory,
  BimElementDocument,
  BimGridDocument,
  BimLevelDocument,
  BimTypeParameters,
  GroupedScheduleRow,
  ScheduleQueryOptions,
  ScheduleSummary,
} from './BimDatabaseTypes';
import { StructuralDefinition, quantities } from '../model/Geometry';
import { LEVELS } from '../../config/structural.config';

export type BimDatabaseChangeListener = (
  action: 'insert' | 'update' | 'delete' | 'clear' | 'quantities',
  document?: BimElementDocument | BimGridDocument | BimLevelDocument
) => void;

/**
 * Generador de UUID v4 estándar RFC 4122 para GUIDs únicos mundiales (128-bit)
 */
function generateGuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Base de Datos Relacional Orientada a Objetos para BIM (MongoDB Ready)
 * Centraliza todas las entidades del modelo con asociatividad bidireccional,
 * jerarquía de 4 niveles Revit (Categoría -> Familia -> Tipo -> Ejemplar) y
 * compatibilidad plena con MongoDB BSON y OpenBIM IFC.
 */
export class BimDatabase {
  public revision = 0;
  private static instance: BimDatabase;

  // Secuencia numérica Revit Element ID (inicia en 100001)
  private nextElementId = 100001;

  // Colecciones documentales BSON-like
  private elements = new Map<string, BimElementDocument>(); // Key: uniqueId (GUID)
  private elementIdMap = new Map<number, string>(); // elementId -> uniqueId
  private legacyIdMap = new Map<string, string>(); // legacy id (ej: "COL-001") -> uniqueId

  // Colecciones de Rejillas y Niveles
  private grids = new Map<string, BimGridDocument>(); // Key: uniqueId (GUID)
  private gridRuntimeIdMap = new Map<string, string>(); // grid.id (ej: "x-1") -> uniqueId
  private gridElementIdMap = new Map<number, string>(); // elementId -> uniqueId

  private levels = new Map<string, BimLevelDocument>(); // Key: uniqueId (GUID)
  private levelRuntimeIdMap = new Map<string, string>(); // level.id (ej: "lvl-1") -> uniqueId
  private levelElementIdMap = new Map<number, string>(); // elementId -> uniqueId

  // Catálogo de Parámetros de Tipo predefinidos de familias (Revit Type Parameters)
  private typeCatalog = new Map<string, BimTypeParameters>([
    // Cimentaciones Aisladas (OST_StructuralFoundation)
    [
      'ZAP-2.0x2.0',
      {
        typeId: 'ZAP-2.0x2.0',
        typeName: '2.00 × 2.00 × 0.60 m',
        category: 'OST_StructuralFoundation',
        width: 2.0,
        depth: 2.0,
        height: 0.6,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 140, // USD/m³
        structuralRole: 'Cimentación Aislada',
      },
    ],
    [
      'ZAP-1.5x1.5',
      {
        typeId: 'ZAP-1.5x1.5',
        typeName: '1.50 × 1.50 × 0.50 m',
        category: 'OST_StructuralFoundation',
        width: 1.5,
        depth: 1.5,
        height: 0.5,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 140,
        structuralRole: 'Cimentación Aislada Menor',
      },
    ],
    [
      'ZAP-2.5x2.5',
      {
        typeId: 'ZAP-2.5x2.5',
        typeName: '2.50 × 2.50 × 0.70 m',
        category: 'OST_StructuralFoundation',
        width: 2.5,
        depth: 2.5,
        height: 0.7,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 155,
        structuralRole: 'Cimentación Aislada de Gran Capacidad',
      },
    ],

    // Pilares Estructurales (OST_StructuralColumns)
    [
      'COL-0.4x0.4',
      {
        typeId: 'COL-0.4x0.4',
        typeName: '0.40 × 0.40 m',
        category: 'OST_StructuralColumns',
        width: 0.4,
        depth: 0.4,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 175, // USD/m³
        structuralRole: 'Pilar Estructural Cuadrado',
      },
    ],
    [
      'COL-0.5x0.5',
      {
        typeId: 'COL-0.5x0.5',
        typeName: '0.50 × 0.50 m',
        category: 'OST_StructuralColumns',
        width: 0.5,
        depth: 0.5,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 175,
        structuralRole: 'Pilar Estructural Central',
      },
    ],
    [
      'COL-0.3x0.5',
      {
        typeId: 'COL-0.3x0.5',
        typeName: '0.30 × 0.50 m',
        category: 'OST_StructuralColumns',
        width: 0.3,
        depth: 0.5,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 175,
        structuralRole: 'Pilar Estructural Rectangular',
      },
    ],

    // Armazón Estructural - Vigas (OST_StructuralFraming)
    [
      'VIG-0.4x0.55',
      {
        typeId: 'VIG-0.4x0.55',
        typeName: '0.40 × 0.55 m',
        category: 'OST_StructuralFraming',
        width: 0.4,
        height: 0.55,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 165, // USD/m³
        structuralRole: 'Viga de Pórtico Sismorresistente',
      },
    ],
    [
      'VIG-0.3x0.50',
      {
        typeId: 'VIG-0.3x0.50',
        typeName: '0.30 × 0.50 m',
        category: 'OST_StructuralFraming',
        width: 0.3,
        height: 0.50,
        defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
        concreteStrength: 280,
        unitCost: 165,
        structuralRole: 'Viga Secundaria',
      },
    ],
    [
      'VIG-0.25x0.40',
      {
        typeId: 'VIG-0.25x0.40',
        typeName: '0.25 × 0.40 m',
        category: 'OST_StructuralFraming',
        width: 0.25,
        height: 0.40,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 155,
        structuralRole: 'Viga de Amarre / Riostra',
      },
    ],

    // Suelos / Losas (OST_Floors)
    [
      'LOS-0.20',
      {
        typeId: 'LOS-0.20',
        typeName: 'Espesor e = 0.20 m',
        category: 'OST_Floors',
        thickness: 0.2,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 130, // USD/m³
        structuralRole: 'Losa / Diafragma Rígido',
      },
    ],
    [
      'LOS-0.15',
      {
        typeId: 'LOS-0.15',
        typeName: 'Espesor e = 0.15 m',
        category: 'OST_Floors',
        thickness: 0.15,
        defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
        concreteStrength: 210,
        unitCost: 130,
        structuralRole: 'Losa Alivianada / Techo',
      },
    ],
  ]);

  private listeners: Set<BimDatabaseChangeListener> = new Set();

  private constructor() {}

  public static getInstance(): BimDatabase {
    if (!BimDatabase.instance) {
      BimDatabase.instance = new BimDatabase();
    }
    return BimDatabase.instance;
  }

  public subscribe(listener: BimDatabaseChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(
    action: 'insert' | 'update' | 'delete' | 'clear' | 'quantities',
    doc?: BimElementDocument | BimGridDocument | BimLevelDocument
  ): void {
    if(action!=='quantities'){
      this.revision++;
      this.elements.forEach(d=>{const p=d.instanceParameters;p.volume=p.grossVolume??p.volume;p.grossVolume=p.volume;p.netVolume=undefined;p.overlapVolume=undefined;p.deductedBy=[];p.steelMass=undefined;p.quantityState='pending';p.estimatedCost=p.volume*d.typeParameters.unitCost;});
    }
    this.listeners.forEach((fn) => {
      try {
        fn(action, doc);
      } catch (err) {
        console.error('Error en listener de BimDatabase:', err);
      }
    });
  }

  // ==========================================
  // GESTIÓN DEL CATÁLOGO DE TIPOS (POO - CLASES)
  // ==========================================

  public getTypeCatalog(): BimTypeParameters[] {
    return Array.from(this.typeCatalog.values());
  }

  public updateGeometry(guid: string, definition: StructuralDefinition, retainedTypeId?: string): void {
    const doc = this.elements.get(guid);
    if (!doc) return;
    const q = quantities(definition);
    doc.geometry = { origin: q.origin, dimensionsString: q.dimensions, definition: structuredClone(definition) };
    Object.assign(doc.instanceParameters, {
      volume:q.volume, grossVolume:q.volume, surfaceArea:q.surfaceArea, length:q.length, height:q.height,
      estimatedCost:q.volume*doc.typeParameters.unitCost,
    });
    const dims = definition.type==='slab' ? {thickness:definition.thickness}
      : definition.type==='column' ? {width:definition.width,depth:definition.depth}
      : definition.type==='beam' ? {width:definition.width,height:definition.height}
      : {width:definition.width,depth:definition.length,height:definition.height};
    const signature = retainedTypeId || `${definition.type}:${Object.values(dims).map(v=>v.toFixed(6)).join(':')}:${doc.typeParameters.unitCost}:${doc.typeParameters.defaultMaterial}`;
    doc.typeId = signature;
    doc.familyType = retainedTypeId ? this.typeCatalog.get(retainedTypeId)?.typeName || doc.familyType : Object.values(dims).map(v=>v.toFixed(3)).join(' x ') + ' m';
    doc.typeParameters = {...doc.typeParameters,...dims,typeId:signature,typeName:doc.familyType};
    this.typeCatalog.set(signature,{...doc.typeParameters});
    doc.metadata.updatedAt=new Date().toISOString(); doc.metadata.version++;
    this.notify('update',doc);
  }

  public restoreElements(documents: BimElementDocument[]): void {
    this.elements.clear(); this.elementIdMap.clear(); this.legacyIdMap.clear();
    for (const original of documents) {
      const doc=structuredClone(original);
      this.elements.set(doc.uniqueId,doc); this.elementIdMap.set(doc.elementId,doc.uniqueId);
      this.nextElementId=Math.max(this.nextElementId,doc.elementId+1);
      this.typeCatalog.set(doc.typeId,{...doc.typeParameters,typeId:doc.typeId,typeName:doc.familyType});
      this.updateGeometry(doc.uniqueId,doc.geometry.definition!,doc.typeId);
      // Restoring recalculates derived quantities, but is not an edit of the saved element.
      doc.metadata=structuredClone(original.metadata);
    }
    this.notify('update');
  }

  public applyJoinedQuantities(revision:number,rows:{id:string;gross:number;net:number;deduction:number;deductedBy:string[]}[],steel=new Map<string,number>()):boolean {
    if(revision!==this.revision||rows.length!==this.elements.size||new Set(rows.map(r=>r.id)).size!==rows.length)return false;
    for(const r of rows){if(!this.elements.has(r.id)||![r.gross,r.net,r.deduction].every(Number.isFinite)||r.net<0||r.net>r.gross+1e-6)throw new Error('Metrado neto no valido.');}
    rows.forEach(r=>{const d=this.elements.get(r.id)!,p=d.instanceParameters;Object.assign(p,{grossVolume:r.gross,volume:r.net,netVolume:r.net,overlapVolume:r.deduction,deductedBy:r.deductedBy,quantityState:'ready',steelMass:steel.get(r.id),estimatedCost:r.net*d.typeParameters.unitCost});});
    this.notify('quantities');return true;
  }
  public markJoinError(revision:number):void{if(revision!==this.revision)return;this.elements.forEach(d=>d.instanceParameters.quantityState='error');this.notify('quantities');}
  public setReinforcement(id:string,spec:BimElementDocument['reinforcement']):void{
    const doc=this.elements.get(id);if(!doc)return;
    doc.reinforcement=spec?structuredClone(spec):undefined;doc.metadata.version++;doc.metadata.updatedAt=new Date().toISOString();this.notify('update',doc);
  }

  public getTypeParameters(typeId: string): BimTypeParameters | undefined {
    return this.typeCatalog.get(typeId);
  }

  public reconcileLevels(levels: {id:string;name:string}[]): void {
    for(const doc of this.elements.values()){
      const level=levels.find(l=>l.id===doc.levelId)||levels.find(l=>l.name===doc.levelName);
      if(level&&(doc.levelId!==level.id||doc.levelName!==level.name)){
        doc.levelId=level.id;doc.levelName=level.name;doc.instanceParameters.baseLevel=level.name;
        this.notify('update',doc);
      }
    }
  }

  public getTypesByCategory(category: BimCategory): BimTypeParameters[] {
    return Array.from(this.typeCatalog.values()).filter((t) => t.category === category);
  }

  /**
   * Modifica los parámetros de un Tipo (Class definition).
   * REGLA REVIT: Los cambios en los "Parámetros de Tipo" afectan a todas las instancias de ese tipo.
   */
  public updateTypeParameters(
    typeId: string,
    updates: Partial<BimTypeParameters>
  ): void {
    const existing = this.typeCatalog.get(typeId);
    if (!existing) return;

    const candidate={...existing,...updates};
    if(!Number.isFinite(candidate.unitCost)||candidate.unitCost<0||!Number.isFinite(candidate.concreteStrength)||candidate.concreteStrength<=0)throw new Error('Propiedades de tipo no validas.');
    const affected=[...this.elements.values()].filter(d=>d.typeId===typeId);
    const definitions=affected.map(d=>this.definitionForType(d.geometry.definition,candidate));
    Object.assign(existing, updates);

    // Propagar a todas las instancias pertenecientes a este tipo
    affected.forEach((doc,i)=>{
      Object.assign(doc.typeParameters,updates);
      if(updates.concreteStrength!==undefined)doc.instanceParameters.concreteStrength=updates.concreteStrength;
      this.updateGeometry(doc.uniqueId,definitions[i],typeId);
    });
  }

  private definitionForType(source:StructuralDefinition,type:BimTypeParameters):StructuralDefinition {
    const d=structuredClone(source);
    if(d.type==='slab')d.thickness=type.thickness ?? d.thickness;
    else {d.width=type.width ?? d.width;if(d.type==='column')d.depth=type.depth ?? d.depth;else {d.height=type.height ?? d.height;if(d.type==='footing')d.length=type.depth ?? d.length;}}
    quantities(d);return d;
  }

  // ==========================================
  // INSERCIÓN Y CREACIÓN DE ELEMENTOS
  // ==========================================

  /**
   * Crea e inserta un nuevo documento de elemento estructural con IDs duales Revit y MongoDB
   */
  public registerElement(params: {
    definition: StructuralDefinition;
    legacyId: string;
    category: 'footing' | 'column' | 'beam' | 'slab';
    volume: number;
    levelName: string;
    dimensions: string;
    coordinates?: { x: number; y: number; z: number };
    length?: number;
    height?: number;
    markCode?: string;
    typeId?: string;
  }): BimElementDocument {
    const derived=quantities(params.definition);
    const guid = generateGuid();
    const elementId = this.nextElementId++;

    const categoryMap: Record<
      'footing' | 'column' | 'beam' | 'slab',
      {
        category: BimCategory;
        categoryName: string;
        family: string;
        defaultTypeId: string;
        prefix: string;
        ifcEntity: string;
      }
    > = {
      footing: {
        category: 'OST_StructuralFoundation',
        categoryName: 'Cimentación estructural',
        family: 'Zapata Aislada de Concreto',
        defaultTypeId: 'ZAP-2.0x2.0',
        prefix: 'Z-',
        ifcEntity: 'IfcFooting',
      },
      column: {
        category: 'OST_StructuralColumns',
        categoryName: 'Pilares estructurales',
        family: 'Columna de Concreto Rectangular',
        defaultTypeId: 'COL-0.4x0.4',
        prefix: 'C-',
        ifcEntity: 'IfcColumn',
      },
      beam: {
        category: 'OST_StructuralFraming',
        categoryName: 'Armazón estructural (Vigas)',
        family: 'Viga Peraltada de Concreto',
        defaultTypeId: 'VIG-0.4x0.55',
        prefix: 'V-',
        ifcEntity: 'IfcBeam',
      },
      slab: {
        category: 'OST_Floors',
        categoryName: 'Suelos (Losas)',
        family: 'Losa Maciza de Concreto',
        defaultTypeId: 'LOS-0.20',
        prefix: 'L-',
        ifcEntity: 'IfcSlab',
      },
    };

    const catInfo = categoryMap[params.category];
    const selectedTypeId = params.typeId || catInfo.defaultTypeId;
    const typeParams = this.typeCatalog.get(selectedTypeId) || this.typeCatalog.get(catInfo.defaultTypeId)!;

    // Cálculo del área de encofrado (superficie de contacto estimada)
    let surfaceArea = 0;
    if (params.category === 'column') {
      const h = params.height || (typeParams.depth && params.volume / ((typeParams.width || 0.4) * (typeParams.depth || 0.4))) || 3.5;
      const w = typeParams.width || 0.4;
      const d = typeParams.depth || 0.4;
      surfaceArea = 2 * (w + d) * h; // Perímetro * altura
    } else if (params.category === 'beam') {
      const l = params.length || (typeParams.height && params.volume / ((typeParams.width || 0.4) * (typeParams.height || 0.55))) || 6.0;
      const w = typeParams.width || 0.4;
      const h = typeParams.height || 0.55;
      surfaceArea = (w + 2 * h) * l; // Fondo + dos laterales
    } else if (params.category === 'footing') {
      const w = typeParams.width || 2.0;
      const h = typeParams.height || 0.6;
      surfaceArea = 4 * w * h; // 4 caras laterales de la zapata
    } else if (params.category === 'slab') {
      const t = typeParams.thickness || 0.2;
      surfaceArea = params.volume / t; // Área de encofrado de fondo
    }

    const markNumber = params.legacyId.split('-')[1] || elementId.toString().slice(-3);
    const mark = params.markCode || `${catInfo.prefix}${parseInt(markNumber.replace(/\D/g,''), 10) || elementId}`;

    const now = new Date().toISOString();
    const doc: BimElementDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: catInfo.category,
      categoryName: catInfo.categoryName,
      family: catInfo.family,
      familyType: typeParams.typeName,
      typeId: typeParams.typeId || selectedTypeId,
      levelId: LEVELS.find(l=>l.name===params.levelName)?.id || params.levelName,
      levelName: params.levelName,
      typeParameters: { ...typeParams },
      instanceParameters: {
        mark,
        sector: 'Sector A',
        phase: 'Nueva Construcción',
        baseLevel: params.levelName,
        baseOffset: 0.0,
        length: params.length,
        height: params.height,
        volume: derived.volume,
        surfaceArea: derived.surfaceArea,
        concreteStrength: typeParams.concreteStrength,
        estimatedCost: derived.volume * typeParams.unitCost,
        comments: '',
      },
      geometry: {
        definition: structuredClone(params.definition),
        origin: params.coordinates || { x: 0, y: 0, z: 0 },
        dimensionsString: params.dimensions,
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        software: 'ARM Structural',
        ifcEntity: catInfo.ifcEntity,
      },
    };

    this.elements.set(guid, doc);
    this.elementIdMap.set(elementId, guid);
    this.legacyIdMap.set(params.legacyId, guid);

    this.notify('insert', doc);
    return doc;
  }

  // ==========================================
  // BÚSQUEDA Y CONSULTAS TIPO MONGODB
  // ==========================================

  public getByGuid(guid: string): BimElementDocument | undefined {
    return this.elements.get(guid);
  }

  public getByElementId(elementId: number): BimElementDocument | undefined {
    const guid = this.elementIdMap.get(elementId);
    return guid ? this.elements.get(guid) : undefined;
  }

  public getByLegacyId(legacyId: string): BimElementDocument | undefined {
    const guid = this.legacyIdMap.get(legacyId);
    return guid ? this.elements.get(guid) : undefined;
  }

  /**
   * Busca un elemento estructural ya sea por Element ID numérico (ej. 100045) o por GUID completo/parcial
   */
  public searchById(idString: string): BimElementDocument | undefined {
    const res = this.searchAnyById(idString);
    if (res && res.type === 'element') {
      return res.doc as BimElementDocument;
    }
    return undefined;
  }

  /**
   * Busca en cualquier colección BIM (Elementos, Rejillas o Niveles) por Element ID, GUID, Nombre o Marca.
   */
  public searchAnyById(
    idString: string
  ): { type: 'element' | 'grid' | 'level'; doc: BimAnyDocument } | undefined {
    const trimmed = idString.trim();
    if (!trimmed) return undefined;

    // 1. Probar número entero directo
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      if (this.elementIdMap.has(num)) {
        const guid = this.elementIdMap.get(num)!;
        return { type: 'element', doc: this.elements.get(guid)! };
      }
      if (this.gridElementIdMap.has(num)) {
        const guid = this.gridElementIdMap.get(num)!;
        return { type: 'grid', doc: this.grids.get(guid)! };
      }
      if (this.levelElementIdMap.has(num)) {
        const guid = this.levelElementIdMap.get(num)!;
        return { type: 'level', doc: this.levels.get(guid)! };
      }
    }

    // 2. Probar GUID exacto
    if (this.elements.has(trimmed)) {
      return { type: 'element', doc: this.elements.get(trimmed)! };
    }
    if (this.grids.has(trimmed)) {
      return { type: 'grid', doc: this.grids.get(trimmed)! };
    }
    if (this.levels.has(trimmed)) {
      return { type: 'level', doc: this.levels.get(trimmed)! };
    }

    // 3. Probar por runtime ID de rejilla o nivel (ej: "x-1", "lvl-1")
    if (this.gridRuntimeIdMap.has(trimmed)) {
      const guid = this.gridRuntimeIdMap.get(trimmed)!;
      return { type: 'grid', doc: this.grids.get(guid)! };
    }
    if (this.levelRuntimeIdMap.has(trimmed)) {
      const guid = this.levelRuntimeIdMap.get(trimmed)!;
      return { type: 'level', doc: this.levels.get(guid)! };
    }

    // 4. Probar por legacyId de elemento (ej: "COL-001")
    if (this.legacyIdMap.has(trimmed)) {
      const guid = this.legacyIdMap.get(trimmed)!;
      return { type: 'element', doc: this.elements.get(guid)! };
    }

    // 5. Coincidencias por Marca o Nombre
    const qLower = trimmed.toLowerCase();
    for (const doc of this.elements.values()) {
      if (
        doc.instanceParameters.mark.toLowerCase() === qLower ||
        doc.uniqueId.toLowerCase().startsWith(qLower)
      ) {
        return { type: 'element', doc };
      }
    }

    for (const doc of this.grids.values()) {
      if (
        doc.name.toLowerCase() === qLower ||
        doc.uniqueId.toLowerCase().startsWith(qLower)
      ) {
        return { type: 'grid', doc };
      }
    }

    for (const doc of this.levels.values()) {
      if (
        doc.name.toLowerCase().includes(qLower) ||
        doc.uniqueId.toLowerCase().startsWith(qLower)
      ) {
        return { type: 'level', doc };
      }
    }

    return undefined;
  }

  public getAllElements(): BimElementDocument[] {
    return Array.from(this.elements.values());
  }

  /**
   * Consulta filtrada para Tablas de Planificación (Schedules) con soporte para agrupación
   */
  public querySchedule(options: ScheduleQueryOptions = {}): {
    records: BimElementDocument[];
    groupedRecords?: GroupedScheduleRow[];
    summary: ScheduleSummary;
  } {
    let list = Array.from(this.elements.values());

    if (options.category && options.category !== 'ALL') {
      list = list.filter((e) => e.category === options.category);
    }

    if (options.levelName && options.levelName !== 'ALL') {
      list = list.filter((e) => e.levelName === options.levelName);
    }

    if (options.sector && options.sector !== 'ALL') {
      list = list.filter((e) => e.instanceParameters.sector === options.sector);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.elementId.toString().includes(q) ||
          e.uniqueId.toLowerCase().includes(q) ||
          e.instanceParameters.mark.toLowerCase().includes(q) ||
          e.familyType.toLowerCase().includes(q) ||
          e.categoryName.toLowerCase().includes(q) ||
          e.levelName.toLowerCase().includes(q)
      );
    }

    // Ordenar de manera lógica: por Categoría, luego por Nivel, luego por Element ID
    list.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.levelName !== b.levelName) return a.levelName.localeCompare(b.levelName);
      return a.elementId - b.elementId;
    });

    const summary: ScheduleSummary = list.reduce(
      (acc, el) => {
        acc.totalCount += 1;
        acc.totalVolume += el.instanceParameters.volume;
        acc.totalSurfaceArea += el.instanceParameters.surfaceArea;
        acc.totalCost += el.instanceParameters.estimatedCost;
        return acc;
      },
      { totalCount: 0, totalVolume: 0, totalSurfaceArea: 0, totalCost: 0 }
    );

    summary.totalVolume = Number(summary.totalVolume.toFixed(3));
    summary.totalSurfaceArea = Number(summary.totalSurfaceArea.toFixed(2));
    summary.totalCost = Number(summary.totalCost.toFixed(2));

    // Si se solicitó agrupar por Tipo de Familia (Revit: desmarcar "Detallar cada ejemplar")
    let groupedRecords: GroupedScheduleRow[] | undefined;
    if (options.groupByType) {
      const groupMap = new Map<string, GroupedScheduleRow>();
      list.forEach((el) => {
        const key = `${el.typeId}:${el.instanceParameters.concreteStrength}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            typeId: el.typeId,
            familyType: el.familyType,
            categoryName: el.categoryName,
            category: el.category,
            count: 0,
            levelNames: [],
            sectors: [],
            avgConcreteStrength: el.instanceParameters.concreteStrength,
            totalVolume: 0,
            totalSurfaceArea: 0,
            totalCost: 0,
            guids: [],
          });
        }
        const grp = groupMap.get(key)!;
        grp.count += 1;
        grp.totalVolume += el.instanceParameters.volume;
        grp.totalSurfaceArea += el.instanceParameters.surfaceArea;
        grp.totalCost += el.instanceParameters.estimatedCost;
        grp.guids.push(el.uniqueId);
        if (!grp.levelNames.includes(el.levelName)) {
          grp.levelNames.push(el.levelName);
        }
        if (!grp.sectors.includes(el.instanceParameters.sector)) {
          grp.sectors.push(el.instanceParameters.sector);
        }
      });

      groupedRecords = Array.from(groupMap.values()).map((g) => ({
        ...g,
        totalVolume: Number(g.totalVolume.toFixed(3)),
        totalSurfaceArea: Number(g.totalSurfaceArea.toFixed(2)),
        totalCost: Number(g.totalCost.toFixed(2)),
      }));
    }

    return { records: list, groupedRecords, summary };
  }

  // ==========================================
  // MODIFICACIONES BIDIRECCIONALES
  // ==========================================

  /**
   * Cambia el Tipo de un elemento a otro del catálogo (ej. COL-0.4x0.4 -> COL-0.5x0.5)
   */
  public changeElementType(guid: string, newTypeId: string): BimElementDocument | undefined {
    const doc = this.elements.get(guid);
    if (!doc) return undefined;

    const newType = this.typeCatalog.get(newTypeId);
    if (!newType) return undefined;
    if(newType.category && newType.category!==doc.category)throw new Error('El tipo pertenece a otra categoria.');
    const definition=this.definitionForType(doc.geometry.definition,newType);

    doc.typeId = newTypeId;
    doc.familyType = newType.typeName;
    doc.typeParameters = { ...newType };

    doc.instanceParameters.concreteStrength = newType.concreteStrength;
    this.updateGeometry(guid,definition,newTypeId);
    return doc;
  }

  /**
   * Actualiza parámetros de ejemplar de un elemento con sincronización bidireccional
   */
  public updateInstanceParameters(
    guid: string,
    updates: Partial<BimElementDocument['instanceParameters']>
  ): BimElementDocument | undefined {
    const doc = this.elements.get(guid);
    if (!doc) return undefined;

    if(updates.concreteStrength!==undefined&&(!Number.isFinite(updates.concreteStrength)||updates.concreteStrength<=0))throw new Error('Resistencia no valida.');
    const definition=structuredClone(doc.geometry.definition);
    if(updates.baseOffset!==undefined){
      if(!Number.isFinite(updates.baseOffset))throw new Error('Desfase no valido.');
      const delta=updates.baseOffset-doc.instanceParameters.baseOffset;
      if(definition.type==='column')definition.basePoint.y+=delta;
      if(definition.type==='beam'){definition.startPoint.y+=delta;definition.endPoint.y+=delta;}
      if(definition.type==='footing')definition.center.y+=delta;
      if(definition.type==='slab'){definition.elevationY+=delta;[definition.boundary,...(definition.voids||[])].flat().forEach(p=>p.y+=delta);}
    }
    quantities(definition);
    Object.assign(doc.instanceParameters, updates);
    this.updateGeometry(guid,definition,doc.typeId);
    return doc;
  }

  public deleteElement(guid: string): boolean {
    const doc = this.elements.get(guid);
    if (!doc) return false;

    this.elements.delete(guid);
    this.elementIdMap.delete(doc.elementId);
    for (const [k, v] of this.legacyIdMap.entries()) {
      if (v === guid) {
        this.legacyIdMap.delete(k);
        break;
      }
    }

    this.notify('delete', doc);
    return true;
  }

  public clearAll(): void {
    this.elements.clear();
    this.elementIdMap.clear();
    this.legacyIdMap.clear();
    this.nextElementId = 100001;
    this.notify('clear');
  }

  // ==========================================
  // REJILLAS (GRIDS) EN LA BASE DE DATOS
  // ==========================================

  public syncGrid(grid: {
    id: string;
    name: string;
    geomType: 'line' | 'arc';
    start: { x: number; z: number };
    end: { x: number; z: number };
    length?: number;
    showStartBubble?: boolean;
    showEndBubble?: boolean;
    isLocked?: boolean;
  }): BimGridDocument {
    const existingGuid = this.gridRuntimeIdMap.get(grid.id);
    const now = new Date().toISOString();

    const len =
      grid.length ||
      Number(
        Math.hypot(grid.end.x - grid.start.x, grid.end.z - grid.start.z).toFixed(2)
      );

    if (existingGuid && this.grids.has(existingGuid)) {
      const doc = this.grids.get(existingGuid)!;
      doc.name = grid.name;
      doc.geomType = grid.geomType;
      doc.start = { x: grid.start.x, y: 0, z: grid.start.z };
      doc.end = { x: grid.end.x, y: 0, z: grid.end.z };
      doc.length = len;
      doc.showStartBubble = grid.showStartBubble !== false;
      doc.showEndBubble = grid.showEndBubble !== false;
      doc.isLocked = grid.isLocked !== false;
      doc.metadata.updatedAt = now;
      doc.metadata.version += 1;
      this.notify('update', doc);
      return doc;
    }

    const guid = generateGuid();
    const elementId = this.nextElementId++;

    const doc: BimGridDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: 'OST_Grids',
      categoryName: 'Rejillas',
      family: 'Rejilla Estándar Circular 6.5mm',
      name: grid.name,
      geomType: grid.geomType,
      start: { x: grid.start.x, y: 0, z: grid.start.z },
      end: { x: grid.end.x, y: 0, z: grid.end.z },
      length: len,
      showStartBubble: grid.showStartBubble !== false,
      showEndBubble: grid.showEndBubble !== false,
      isLocked: grid.isLocked !== false,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        software: 'Autodesk Revit Compatible BIM Engine v2026',
        ifcEntity: 'IfcGrid',
      },
    };

    this.grids.set(guid, doc);
    this.gridRuntimeIdMap.set(grid.id, guid);
    this.gridElementIdMap.set(elementId, guid);

    this.notify('insert', doc);
    return doc;
  }

  public deleteGrid(gridId: string): boolean {
    const guid = this.gridRuntimeIdMap.get(gridId);
    if (!guid) return false;

    const doc = this.grids.get(guid);
    if (!doc) return false;

    this.grids.delete(guid);
    this.gridRuntimeIdMap.delete(gridId);
    this.gridElementIdMap.delete(doc.elementId);

    this.notify('delete', doc);
    return true;
  }

  public clearGrids(): void {
    this.grids.clear();
    this.gridRuntimeIdMap.clear();
    this.gridElementIdMap.clear();
  }

  public getAllGrids(): BimGridDocument[] {
    return Array.from(this.grids.values());
  }

  public getGridByElementId(elementId: number): BimGridDocument | undefined {
    const guid = this.gridElementIdMap.get(elementId);
    return guid ? this.grids.get(guid) : undefined;
  }

  public getGridByGuid(guid: string): BimGridDocument | undefined {
    return this.grids.get(guid);
  }

  // ==========================================
  // NIVELES (LEVELS) EN LA BASE DE DATOS
  // ==========================================

  public syncLevel(level: {
    id: string;
    name: string;
    elevation: number;
    hasPlanView?: boolean;
  }): BimLevelDocument {
    const existingGuid = this.levelRuntimeIdMap.get(level.id);
    const now = new Date().toISOString();

    if (existingGuid && this.levels.has(existingGuid)) {
      const doc = this.levels.get(existingGuid)!;
      doc.name = level.name;
      doc.elevation = level.elevation;
      doc.hasFloorPlan = level.hasPlanView !== false;
      doc.metadata.updatedAt = now;
      doc.metadata.version += 1;
      this.notify('update', doc);
      return doc;
    }

    const guid = generateGuid();
    const elementId = this.nextElementId++;

    const doc: BimLevelDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: 'OST_Levels',
      categoryName: 'Niveles',
      family: 'Nivel con Cota 8mm',
      name: level.name,
      elevation: level.elevation,
      hasFloorPlan: level.hasPlanView !== false,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        software: 'Autodesk Revit Compatible BIM Engine v2026',
        ifcEntity: 'IfcBuildingStorey',
      },
    };

    this.levels.set(guid, doc);
    this.levelRuntimeIdMap.set(level.id, guid);
    this.levelElementIdMap.set(elementId, guid);

    this.notify('insert', doc);
    return doc;
  }

  public deleteLevel(levelId: string): boolean {
    const guid = this.levelRuntimeIdMap.get(levelId);
    if (!guid) return false;

    const doc = this.levels.get(guid);
    if (!doc) return false;

    this.levels.delete(guid);
    this.levelRuntimeIdMap.delete(levelId);
    this.levelElementIdMap.delete(doc.elementId);

    this.notify('delete', doc);
    return true;
  }

  public clearLevels(): void {
    this.levels.clear();
    this.levelRuntimeIdMap.clear();
    this.levelElementIdMap.clear();
  }

  public getAllLevels(): BimLevelDocument[] {
    return Array.from(this.levels.values());
  }

  public getLevelByElementId(elementId: number): BimLevelDocument | undefined {
    const guid = this.levelElementIdMap.get(elementId);
    return guid ? this.levels.get(guid) : undefined;
  }

  public getLevelByGuid(guid: string): BimLevelDocument | undefined {
    return this.levels.get(guid);
  }

  // ==========================================
  // EXPORTACIÓN Y COMPATIBILIDAD CON MONGODB
  // ==========================================

  /**
   * Genera el dump en JSON BSON-ready listo para `mongoimport` o consumo por MongoDB
   */
  public exportMongoDump(): string {
    const dump = {
      database: 'bim_structural_db',
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      schemaStandard: 'OpenBIM IFC4 / Autodesk Revit Schema',
      collections: {
        elements: Array.from(this.elements.values()),
        grids: Array.from(this.grids.values()),
        levels: Array.from(this.levels.values()),
        types: Array.from(this.typeCatalog.entries()).map(([key, value]) => ({
          _id: key,
          ...value,
        })),
      },
      stats: {
        totalElements: this.elements.size,
        totalGrids: this.grids.size,
        totalLevels: this.levels.size,
        totalTypes: this.typeCatalog.size,
        totalVolume: Number(
          Array.from(this.elements.values())
            .reduce((sum, e) => sum + e.instanceParameters.volume, 0)
            .toFixed(3)
        ),
        totalSurfaceArea: Number(
          Array.from(this.elements.values())
            .reduce((sum, e) => sum + e.instanceParameters.surfaceArea, 0)
            .toFixed(2)
        ),
        totalEstimatedCost: Number(
          Array.from(this.elements.values())
            .reduce((sum, e) => sum + e.instanceParameters.estimatedCost, 0)
            .toFixed(2)
        ),
      },
    };

    return JSON.stringify(dump, null, 2);
  }

  /**
   * Genera archivo CSV para presupuestos, compatibilidad con Excel / Cost-It / Presto
   */
  public exportScheduleCsv(category: BimCategory | 'ALL' = 'ALL'): string {
    const { records } = this.querySchedule({ category });
    const headers = [
      'Element ID',
      'UniqueId (GUID)',
      'Categoría',
      'Familia',
      'Tipo',
      'Código / Marca',
      'Nivel Base',
      'Sector',
      'Fase',
      'Longitud/Altura (m)',
      'Volumen (m3)',
      'Encofrado (m2)',
      'f\'c (kg/cm2)',
      'Costo Est. ($)',
    ];

    const rows = records.map((r) => [
      r.elementId,
      r.uniqueId,
      `"${r.categoryName}"`,
      `"${r.family}"`,
      `"${r.familyType}"`,
      `"${r.instanceParameters.mark}"`,
      `"${r.levelName}"`,
      `"${r.instanceParameters.sector}"`,
      `"${r.instanceParameters.phase}"`,
      (r.instanceParameters.height || r.instanceParameters.length || 0).toFixed(2),
      r.instanceParameters.volume.toFixed(3),
      r.instanceParameters.surfaceArea.toFixed(2),
      r.instanceParameters.concreteStrength,
      r.instanceParameters.estimatedCost.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  public downloadMongoDump(): void {
    const json = this.exportMongoDump();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bim_mongodb_dump_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public downloadCsvExport(category: BimCategory | 'ALL' = 'ALL'): void {
    const csv = this.exportScheduleCsv(category);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bim_schedule_${category.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
