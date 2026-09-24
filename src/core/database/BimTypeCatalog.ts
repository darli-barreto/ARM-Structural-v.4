import type { BimCategory, BimTypeParameters } from './BimDatabaseTypes';

export class BimTypeCatalog {
  private readonly types = new Map<string, BimTypeParameters>([
    ['ZAP-2.0x2.0', {
      typeId: 'ZAP-2.0x2.0',
      typeName: '2.00 × 2.00 × 0.60 m',
      category: 'OST_StructuralFoundation',
      width: 2.0,
      depth: 2.0,
      height: 0.6,
      defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
      concreteStrength: 210,
      unitCost: 140,
      structuralRole: 'Cimentación Aislada',
    }],
    ['ZAP-1.5x1.5', {
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
    }],
    ['ZAP-2.5x2.5', {
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
    }],
    ['COL-0.4x0.4', {
      typeId: 'COL-0.4x0.4',
      typeName: '0.40 × 0.40 m',
      category: 'OST_StructuralColumns',
      width: 0.4,
      depth: 0.4,
      defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
      concreteStrength: 280,
      unitCost: 175,
      structuralRole: 'Pilar Estructural Cuadrado',
    }],
    ['COL-0.5x0.5', {
      typeId: 'COL-0.5x0.5',
      typeName: '0.50 × 0.50 m',
      category: 'OST_StructuralColumns',
      width: 0.5,
      depth: 0.5,
      defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
      concreteStrength: 280,
      unitCost: 175,
      structuralRole: 'Pilar Estructural Central',
    }],
    ['COL-0.3x0.5', {
      typeId: 'COL-0.3x0.5',
      typeName: '0.30 × 0.50 m',
      category: 'OST_StructuralColumns',
      width: 0.3,
      depth: 0.5,
      defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
      concreteStrength: 280,
      unitCost: 175,
      structuralRole: 'Pilar Estructural Rectangular',
    }],
    ['VIG-0.4x0.55', {
      typeId: 'VIG-0.4x0.55',
      typeName: '0.40 × 0.55 m',
      category: 'OST_StructuralFraming',
      width: 0.4,
      height: 0.55,
      defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
      concreteStrength: 280,
      unitCost: 165,
      structuralRole: 'Viga de Pórtico Sismorresistente',
    }],
    ['VIG-0.3x0.50', {
      typeId: 'VIG-0.3x0.50',
      typeName: '0.30 × 0.50 m',
      category: 'OST_StructuralFraming',
      width: 0.3,
      height: 0.50,
      defaultMaterial: 'Concreto Armado f\'c 280 kg/cm²',
      concreteStrength: 280,
      unitCost: 165,
      structuralRole: 'Viga Secundaria',
    }],
    ['VIG-0.25x0.40', {
      typeId: 'VIG-0.25x0.40',
      typeName: '0.25 × 0.40 m',
      category: 'OST_StructuralFraming',
      width: 0.25,
      height: 0.40,
      defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
      concreteStrength: 210,
      unitCost: 155,
      structuralRole: 'Viga de Amarre / Riostra',
    }],
    ['LOS-0.20', {
      typeId: 'LOS-0.20',
      typeName: 'Espesor e = 0.20 m',
      category: 'OST_Floors',
      thickness: 0.2,
      defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
      concreteStrength: 210,
      unitCost: 130,
      structuralRole: 'Losa / Diafragma Rígido',
    }],
    ['LOS-0.15', {
      typeId: 'LOS-0.15',
      typeName: 'Espesor e = 0.15 m',
      category: 'OST_Floors',
      thickness: 0.15,
      defaultMaterial: 'Concreto Armado f\'c 210 kg/cm²',
      concreteStrength: 210,
      unitCost: 130,
      structuralRole: 'Losa Alivianada / Techo',
    }],
  ]);

  public get(typeId: string): BimTypeParameters | undefined {
    return this.types.get(typeId);
  }

  public getAll(): BimTypeParameters[] {
    return Array.from(this.types.values());
  }

  public getByCategory(category: BimCategory): BimTypeParameters[] {
    return this.getAll().filter(type => type.category === category);
  }

  public set(typeId: string, parameters: BimTypeParameters): void {
    this.types.set(typeId, parameters);
  }

  public entries(): IterableIterator<[string, BimTypeParameters]> {
    return this.types.entries();
  }
}
