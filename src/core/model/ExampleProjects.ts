import { BimCategory, BimElementDocument } from '../database/BimDatabaseTypes';
import { deriveAnalysis } from '../analysis/Model';
import { benchmarkModel, BenchmarkId } from '../analysis/Benchmarks';
import { ProjectDocument } from './Project';
import { StructuralDefinition, quantities } from './Geometry';

export type ExampleId='office-8'|BenchmarkId;
export const examples: {id:ExampleId;name:string;size:string;scope:string}[]=[
  {id:'office-8',name:'Oficinas / 8 niveles',size:'42 x 24 m / altura 27.30 m',scope:'Modelo demostrativo. Podio de 4 niveles y retranqueo superior. Portico central con cargas gravitatorias equivalentes. Sin verificacion normativa.'},
  {id:'cantilever',name:'Voladizo / carga puntual',size:'L = 3 m / P = 10 kN',scope:'Referencia analitica Timoshenko. Reaccion, momento y desplazamiento del extremo. Parametros de ensayo propios, sin peso propio.'},
  {id:'supported',name:'Viga biapoyada / carga uniforme',size:'L = 6 m / q = 10 kN/m',scope:'Referencia de equilibrio: reacciones y momento maximo. Sin peso propio.'},
];
const categories:Record<StructuralDefinition['type'],{category:BimCategory;name:string;family:string;prefix:string;ifc:string}>={
  beam:{category:'OST_StructuralFraming',name:'Vigas',family:'Viga rectangular',prefix:'V',ifc:'IfcBeam'},
  column:{category:'OST_StructuralColumns',name:'Columnas',family:'Columna rectangular',prefix:'C',ifc:'IfcColumn'},
  slab:{category:'OST_Floors',name:'Losas',family:'Losa maciza',prefix:'L',ifc:'IfcSlab'},
  footing:{category:'OST_StructuralFoundation',name:'Zapatas',family:'Zapata aislada',prefix:'Z',ifc:'IfcFooting'},
};
export function createExampleProject(id:ExampleId):ProjectDocument {
  const time=new Date().toISOString(),project:ProjectDocument={format:'arm-project',schemaVersion:1,projectId:crypto.randomUUID(),savedAt:time,units:{length:'m',force:'kN',stress:'MPa',concreteStrength:'kgf/cm2'},code:'RNE-PE',elements:[],levels:[],grids:[]};
  const level=(name:string,elevation:number)=>{const l={id:crypto.randomUUID(),name,elevation,start:{x:-26,z:0},end:{x:26,z:0},showStartBubble:true,showEndBubble:true,isLocked:true,hasPlanView:true};project.levels.push(l);return l;};
  const counters={beam:0,column:0,slab:0,footing:0};
  const add=(d:StructuralDefinition,l:ReturnType<typeof level>,sector='Referencia')=>{
    const q=quantities(d),c=categories[d.type],uniqueId=crypto.randomUUID();
    const dims=d.type==='slab'?{thickness:d.thickness}:d.type==='beam'?{width:d.width,height:d.height}:d.type==='column'?{width:d.width,depth:d.depth}:{width:d.width,depth:d.length,height:d.height};
    const name=Object.values(dims).map(v=>v.toFixed(3)).join(' x ')+' m',typeId=`example:${d.type}:${Object.values(dims).join(':')}`;
    const doc:BimElementDocument={_id:uniqueId,uniqueId,elementId:100001+project.elements.length,category:c.category,categoryName:c.name,family:c.family,familyType:name,typeId,levelId:l.id,levelName:l.name,
      typeParameters:{...dims,typeId,typeName:name,category:c.category,defaultMaterial:'Concreto de ejemplo',concreteStrength:280,unitCost:0,structuralRole:c.name},
      instanceParameters:{mark:`${c.prefix}-${++counters[d.type]}`,sector,phase:'Nueva Construcción',baseLevel:l.name,baseOffset:0,volume:q.volume,surfaceArea:q.surfaceArea,length:q.length,height:q.height,concreteStrength:280,estimatedCost:0,comments:'Ejemplo de ensayo. Secciones, cimentaciones y cargas no verificadas por RNE. Costos no presupuestados.'},
      geometry:{definition:d,origin:q.origin,dimensionsString:q.dimensions},metadata:{createdAt:time,updatedAt:time,version:1,software:'ARM Structural',ifcEntity:c.ifc}};
    project.elements.push(doc);return doc;
  };
  const point=(x:number,y:number,z:number)=>({x,y,z});
  if(id!=='office-8'){
    const reference=benchmarkModel(id),m=reference.members[0],l=level('Referencia',0);
    add({type:'beam',startPoint:point(0,m.height/2,0),endPoint:point(reference.nodes[1].x,m.height/2,0),width:id==='cantilever'?.2:.3,height:m.height},l);
    const model=deriveAnalysis(project.elements,0,{plane:'XY',ordinate:0,tolerance:.001,elasticModulusMPa:m.elasticModulusMPa,unitWeight:0});
    model.nodes.forEach((node,i)=>Object.assign(node,{support:reference.nodes[i].support,fy:reference.nodes[i].fy}));
    model.members[0].dead=m.dead;model.members[0].loadReference='Ensayo de referencia propio. Sin peso propio; carga uniforme q = 10 kN/m solo en viga biapoyada.';model.issues.push(...reference.issues);
    project.analysis={model,factors:{dead:1,live:1,nodal:1},caseName:id==='cantilever'?'Referencia P = 10 kN':'Referencia q = 10 kN/m',benchmark:id};
    return project;
  }
  const xs=[-21,-14,-7,0,7,14,21],zs=[-12,-6,0,6,12],base=level('Base',0);
  xs.forEach((x,i)=>project.grids.push({id:crypto.randomUUID(),name:String(i+1),geomType:'line',start:{x,z:-16},end:{x,z:16},showStartBubble:true,showEndBubble:true,isLocked:true}));
  zs.forEach((z,i)=>project.grids.push({id:crypto.randomUUID(),name:String.fromCharCode(65+i),geomType:'line',start:{x:-25,z},end:{x:25,z},showStartBubble:true,showEndBubble:true,isLocked:true}));
  xs.forEach(x=>zs.forEach(z=>add({type:'footing',center:point(x,-.8,z),width:3,length:3,height:.8},base,'Cimentacion')));
  let bottom=0;
  for(let floor=1;floor<=8;floor++){
    const top=4.2+(floor-1)*3.3,l=level(floor===8?'Cubierta':`Nivel ${floor}`,top),activeX=floor<=4?xs:xs.slice(1,-1);
    const column=floor<=4?.7:.55,width=floor<=4?.35:.3,height=floor<=4?.65:.6;
    const sector=floor<=4?'Podio':'Cuerpo superior';
    activeX.forEach(x=>zs.forEach(z=>add({type:'column',columnStyle:'vertical',basePoint:point(x,bottom,z),topPoint:point(x,top,z),width:column,depth:column},l,sector)));
    for(let i=0;i<activeX.length-1;i++)zs.forEach(z=>add({type:'beam',startPoint:point(activeX[i],top,z),endPoint:point(activeX[i+1],top,z),width,height},l,sector));
    activeX.forEach(x=>{for(let j=0;j<zs.length-1;j++)add({type:'beam',startPoint:point(x,top,zs[j]),endPoint:point(x,top,zs[j+1]),width,height},l,sector);});
    for(let i=0;i<activeX.length-1;i++)for(let j=0;j<zs.length-1;j++){
      const x=activeX[i],x2=activeX[i+1],z=zs[j],z2=zs[j+1],y=top-.2,inset=width/2;
      const boundary=[point(x+inset,y,z+inset),point(x2-inset,y,z+inset),point(x2-inset,y,z2-inset),point(x+inset,y,z2-inset)];
      const voids=x===0&&z===0?[[point(2,y,1.4),point(4,y,1.4),point(4,y,4.6),point(2,y,4.6)]]:[];
      add({type:'slab',boundary,voids,thickness:.2,elevationY:y},l,sector);
    }
    bottom=top;
  }
  const model=deriveAnalysis(project.elements,0,{plane:'XY',ordinate:0,tolerance:.001,elasticModulusMPa:25000,unitWeight:24});
  model.nodes.forEach(n=>{if(n.y===0)n.support='fixed';});
  model.members.forEach(m=>{
    const d=project.elements.find(d=>d.uniqueId===m.sourceId)!.geometry.definition;
    if(d.type!=='beam')return;
    const roof=Math.abs(d.startPoint.y-27.3)<.001;
    m.dead=(4.8+(roof?1:2.5))*6;m.live=(roof?1:3)*6;
    m.loadReference=`Ensayo manual: ancho tributario 6 m; D=${roof?'(4.8+1)':'(4.8+2.5)'}x6; L=${roof?'1':'3'}x6 kN/m. Sin descuento de huecos ni verificacion E.020.`;
  });
  model.issues.push('Portico central Z=0. E=25000 MPa; peso unitario=24 kN/m3; bases empotradas idealizadas.',
    'Cargas equivalentes MANUALES: ancho tributario 6 m; D adicional=(4.8+2.5)x6=43.8 kN/m; L=3x6=18 kN/m. Cubierta: D=34.8 y L=6 kN/m. Peso propio de barras adicional automatico.',
    'Las cargas equivalentes no descuentan huecos ni representan transferencia automatica de losas. Ejes centroidales subdivididos en sus cruces; sin brazos rigidos ni diafragmas. Peso de barras bruto, distinto del metrado neto.',
    'Sin evaluacion sismica, diafragmas, suelo, armaduras, derivas admisibles ni cumplimiento RNE. Edificio demostrativo, no proyecto aprobado.');
  project.analysis={model,factors:{dead:1,live:1,nodal:1},caseName:'Ensayo gravitatorio D + L / portico central'};
  return project;
}
