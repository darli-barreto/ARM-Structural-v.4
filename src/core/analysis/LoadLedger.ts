import type {BimElementDocument} from '../database/BimDatabaseTypes';
import {quantities} from '../model/Geometry';
import type {AnalysisModel, AnalysisResult} from './Model';
import {assembleFrameLoads,frameInputSignature,type LoadFactors} from './Loads';

export interface LoadSourceRow {
  sourceId:string;mark:string;level:string;material:string;memberIds:string[];
  status:'applied'|'outside-plane'|'transfer-pending'|'transfer-linked'|'unsupported'|'missing-source';
  length:number;analyticalVolume:number;grossVolume:number|null;netVolume:number|null;unitWeight:number|null;
  selfWeight:number;excludedSelfWeight:number;manualDead:number;manualLive:number;surfaceDead:number;surfaceLive:number;downward:number;
  grossReferenceWeight:number|null;netReferenceWeight:number|null;notes:string[];
}

export function buildLoadLedger(model:AnalysisModel,factors:LoadFactors,documents:BimElementDocument[],result?:AnalysisResult){
  const assembled=assembleFrameLoads(model,factors,false),members=new Map(model.members.map(m=>[m.id,m]));
  const docs=new Map(documents.map(d=>[d.uniqueId,d])),groups=new Map<string,typeof assembled.members>();
  if(docs.size!==documents.length)throw new Error('Fuentes BIM duplicadas.');
  assembled.members.forEach(m=>{const group=groups.get(m.sourceId)||[];group.push(m);groups.set(m.sourceId,group);});
  const rows:LoadSourceRow[]=[];
  for(const sourceId of new Set([...groups.keys(),...docs.keys()])){
    const doc=docs.get(sourceId),segments=groups.get(sourceId)||[],notes:string[]=[];
    const type=doc?.geometry.definition.type;
    const surface=assembled.surfaces.find(s=>s.sourceId===sourceId);
    const status:LoadSourceRow['status']=segments.length?(doc?'applied':'missing-source'):type==='slab'?(surface?'transfer-linked':'transfer-pending'):type==='footing'?'unsupported':'outside-plane';
    const grossVolume=doc?quantities(doc.geometry.definition).volume:null;
    const net=doc?.instanceParameters.netVolume;
    const netVolume=doc?.instanceParameters.quantityState==='ready'&&Number.isFinite(net)&&net!>=0&&grossVolume!==null&&net!<=grossVolume+1e-6?net!:null;
    const densities=segments.map(s=>{const m=members.get(s.id)!;return m.weight/m.area;});
    const unitWeight=densities.length&&densities.every(d=>Number.isFinite(d)&&Math.abs(d-densities[0])<1e-9)?densities[0]:null;
    const sum=(key:'length'|'selfWeight'|'excludedSelfWeight'|'manualDead'|'manualLive'|'surfaceDead'|'surfaceLive'|'downward')=>segments.reduce((total,s)=>total+s[key],0);
    const analyticalVolume=segments.reduce((total,s)=>total+members.get(s.id)!.area*s.length,0);
    if(status==='transfer-pending')notes.push('Losa sin transferencia BIM de cargas. Su posible inclusion en D manual no esta vinculada ni verificada.');
    if(surface)notes.push(`Fuente superficial declarada. Pendiente ${(surface.pendingFraction*100).toFixed(2)}%. Cargas contabilizadas solo en receptores; ver detalle superficial.`);
    if(segments.some(s=>(s.surfaceDead||s.surfaceLive)&&(s.manualDead||s.manualLive||s.deadLoadMode==='includes-self-weight')))notes.push('Conflicto de cargas manuales y superficiales; calculo bloqueado hasta conciliar.');
    if(status==='unsupported')notes.push('Cimentacion fuera del motor de barras.');
    if(status==='outside-plane')notes.push('Elemento fuera del portico seleccionado.');
    if(status==='missing-source')notes.push('GUID sin elemento BIM vigente.');
    if(segments.some(s=>(s.manualDead!==0||s.manualLive!==0||s.deadLoadMode==='includes-self-weight')&&!s.reference.trim()))notes.push('Cargas manuales sin referencia completa.');
    if(segments.some(s=>s.deadLoadMode==='includes-self-weight'))notes.push('Peso propio automatico excluido en los tramos declarados como D total; revisar el sustento.');
    if(segments.some(s=>s.deadLoadMode==='includes-self-weight'&&s.manualDead<s.excludedSelfWeight))notes.push('D total menor que el peso propio bruto excluido; revisar hipotesis y valores.');
    if(segments.length&&unitWeight===null)notes.push('Pesos unitarios distintos entre tramos; no hay referencia unica de peso fisico.');
    if(segments.length&&grossVolume!==null&&Math.abs(analyticalVolume-grossVolume)>1e-8*Math.max(1,grossVolume))notes.push('Volumen analitico distinto del bruto geometrico por idealizacion o cobertura de tramos.');
    if(netVolume===null)notes.push('Volumen neto no disponible para esta revision.');
    rows.push({sourceId,mark:doc?.instanceParameters.mark??members.get(segments[0]?.id)?.mark??sourceId,
      level:doc?.levelName??'Sin nivel BIM',material:doc?.typeParameters.defaultMaterial??'Sin material BIM',memberIds:segments.map(s=>s.id),status,
      length:sum('length'),analyticalVolume,grossVolume,netVolume,unitWeight,selfWeight:sum('selfWeight'),excludedSelfWeight:sum('excludedSelfWeight'),manualDead:sum('manualDead'),manualLive:sum('manualLive'),surfaceDead:sum('surfaceDead'),surfaceLive:sum('surfaceLive'),downward:sum('downward'),
      grossReferenceWeight:unitWeight!==null&&grossVolume!==null?unitWeight*grossVolume:null,
      netReferenceWeight:unitWeight!==null&&netVolume!==null?unitWeight*netVolume:null,notes});
  }
  const signature=frameInputSignature(model,factors);
  let loadValidationError:string|null=null;
  try{assembleFrameLoads(model,factors);}catch(error){loadValidationError=(error as Error).message;}
  const resultCurrent=!!result&&result.revision===model.revision&&result.inputSignature===signature;
  const nodes=new Map(model.nodes.map(n=>[n.id,n]));
  const equilibrium=resultCurrent?{
    reactionX:result.nodes.reduce((s,n)=>s+n.rx,0),reactionY:result.nodes.reduce((s,n)=>s+n.ry,0),
    reactionMoment:result.nodes.reduce((s,n)=>{const p=nodes.get(n.id)!;return s+n.rm+p.y*n.rx-p.x*n.ry;},0),
    residual:result.residual,
  }:null;
  const levels=[...new Set(rows.map(r=>r.level))].map(level=>{
    const local=rows.filter(r=>r.level===level);
    return {level,selfWeight:local.reduce((s,r)=>s+r.selfWeight,0),manualDead:local.reduce((s,r)=>s+r.manualDead,0),manualLive:local.reduce((s,r)=>s+r.manualLive,0),surfaceDead:local.reduce((s,r)=>s+r.surfaceDead,0),surfaceLive:local.reduce((s,r)=>s+r.surfaceLive,0),downward:local.reduce((s,r)=>s+r.downward,0),pending:local.filter(r=>r.status==='transfer-pending').length};
  });
  return {format:'arm-load-ledger',schemaVersion:2,modelRevision:model.revision,plane:model.plane,ordinate:model.ordinate,
    units:{length:'m',volume:'m3',lineLoad:'kN/m',force:'kN',moment:'kN m',unitWeight:'kN/m3'},factors:{...factors},inputSignature:signature,
    scope:'Portico 2D. Cargas firmadas; distribuida positiva hacia abajo, Fy positiva hacia arriba. Niveles BIM de receptores, no masas sismicas. Superficies: reparto uniforme declarado que conserva fuerza asignada, no verifica momentos de la fuente ni compatibilidad espacial. Volumen neto solo comparativo; no se aplica al solver.',
    rows,levels,assembled,loadValidationError,equilibrium,resultState:result?(resultCurrent?'current':'stale'):'not-calculated'};
}

export type LoadLedger=ReturnType<typeof buildLoadLedger>;

export function loadLedgerCsv(ledger:LoadLedger):string {
  const cell=(value:unknown)=>{let text=value===null||value===undefined?'':String(value);if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
  const rows:unknown[][]=[['GUID','Marca','Nivel BIM','Material','Estado','Tramos','L FEM (m)','V FEM (m3)','V bruto (m3)','V neto (m3)','Peso unitario (kN/m3)','PP activo (kN)','PP excluido (kN)','D manual (kN)','L manual (kN)','Carga descendente factorizada (kN)','Referencia peso bruto (kN)','Referencia peso neto (kN)','Observaciones']];
  ledger.rows.forEach(r=>rows.push([r.sourceId,r.mark,r.level,r.material,r.status,r.memberIds.join(' / '),r.length,r.analyticalVolume,r.grossVolume,r.netVolume,r.unitWeight,r.selfWeight,r.excludedSelfWeight,r.manualDead,r.manualLive,r.downward,r.grossReferenceWeight,r.netReferenceWeight,r.notes.join(' ')]));
  rows.push([],['Nudo','Fx aplicado (kN)','Fy aplicado (kN)','Momento aplicado (kN m)']);
  ledger.assembled.nodes.forEach(n=>rows.push([n.id,n.fx,n.fy,n.moment]));
  rows.push([],['Tramo','GUID','Declaracion D','Referencia D / L','L FEM (m)','PP activo (kN)','PP excluido (kN)','D manual (kN)','L manual (kN)','q del caso (kN/m)']);
  ledger.assembled.members.forEach(m=>rows.push([m.id,m.sourceId,m.deadLoadMode,m.reference,m.length,m.selfWeight,m.excludedSelfWeight,m.manualDead,m.manualLive,m.lineLoad]));
  const t=ledger.assembled.totals;
  rows.push([],['Validacion de cargas',ledger.loadValidationError??'Sin bloqueos de declaracion; no es verificacion normativa']);
  rows.push([],['Losa GUID','Area con huecos (m2)','Espesor (m)','Peso unitario (kN/m3)','D sobrepuesta (kN/m2)','L (kN/m2)','D total (kN)','L total (kN)','D asignada (kN)','L asignada (kN)','D fuera (kN)','L fuera (kN)','D pendiente (kN)','L pendiente (kN)','Referencia','Sustento fuera del portico']);
  ledger.assembled.surfaces.forEach(s=>rows.push([s.sourceId,s.area,s.thickness,s.unitWeight,s.additionalDead,s.surfaceLive,s.dead,s.live,s.assignedDead,s.assignedLive,s.outsideDead,s.outsideLive,s.pendingDead,s.pendingLive,s.reference,s.outsideReference]));
  rows.push([],['Losa GUID','Viga receptora GUID','Tramos','Fraccion','D transferida (kN)','L transferida (kN)','q D (kN/m)','q L (kN/m)']);
  ledger.assembled.surfaces.forEach(s=>s.allocations.forEach(a=>rows.push([s.sourceId,a.receiverId,a.memberIds.join(' / '),a.fraction,a.dead,a.live,a.qDead,a.qLive])));
  rows.push([],['Tramo','D superficial (kN)','L superficial (kN)']);
  ledger.assembled.members.forEach(m=>rows.push([m.id,m.surfaceDead,m.surfaceLive]));
  rows.push([],['D superficial asignada (kN)','L superficial asignada (kN)'],[t.surfaceDead,t.surfaceLive]);
  rows.push([],['Factor D','Factor L','Factor nodal'],[ledger.factors.dead,ledger.factors.live,ledger.factors.nodal],
    ['PP activo (kN)','PP excluido (kN)','D manual (kN)','L manual (kN)','Fx aplicado (kN)','Fy aplicado (kN)','Momento global horario (kN m)'],[t.selfWeight,t.excludedSelfWeight,t.manualDead,t.manualLive,t.fx,t.fy,t.moment],[],['Alcance',ledger.scope]);
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
