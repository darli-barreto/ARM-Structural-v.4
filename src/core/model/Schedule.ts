import { BimElementDocument } from '../database/BimDatabaseTypes';
export type Grouping = 'instance'|'type'|'level'|'category';
export interface ScheduleRow { ids:string[]; category:string; type:string; mark:string; level:string; sector:string; fc:number; count:number; volume:number; gross:number; deduction:number; steel:number; state:string; surface:number; cost:number; dimensions:string }
export function scheduleRows(records:BimElementDocument[], grouping:Grouping):ScheduleRow[] {
  const groups=new Map<string,ScheduleRow>();
  records.forEach(d=>{
    const p=d.instanceParameters;
    const ready=p.quantityState==='ready',gross=p.grossVolume??p.volume,net=ready?p.netVolume!:NaN,deduction=ready?p.overlapVolume!:NaN,steel=p.steelMass??NaN,state=ready?'Neto':p.quantityState==='error'?'Error de union':'Pendiente';
    const key=grouping==='instance'?d.uniqueId:grouping==='type'?`${d.typeId}:${p.concreteStrength}`:grouping==='level'?d.levelId:d.category;
    const old=groups.get(key);
    if(old){
      old.ids.push(d.uniqueId); old.count++; old.volume+=net;old.gross+=gross;old.deduction+=deduction;old.steel+=steel;old.surface+=p.surfaceArea;old.cost+=ready?p.estimatedCost:NaN;if(old.state!==state)old.state='Parcial';
      if(old.level!==d.levelName)old.level='Varios'; if(old.sector!==p.sector)old.sector='Varios';
      if(old.type!==d.familyType)old.type='Varios';if(old.category!==d.categoryName)old.category='Varias';
      if(old.fc!==p.concreteStrength)old.fc=NaN;old.dimensions='';
    }else groups.set(key,{ids:[d.uniqueId],category:d.categoryName,type:d.familyType,mark:grouping==='instance'?p.mark:'',level:d.levelName,sector:p.sector,fc:p.concreteStrength,count:1,volume:net,gross,deduction,steel,state,surface:p.surfaceArea,cost:ready?p.estimatedCost:NaN,dimensions:d.geometry.dimensionsString});
  });
  return [...groups.values()];
}
export const scheduleColumns: {key:keyof ScheduleRow; label:string; numeric?:boolean}[] = [
  {key:'mark',label:'Marca'},{key:'category',label:'Categoria'},{key:'type',label:'Seccion / Tipo'},
  {key:'level',label:'Nivel'},{key:'sector',label:'Sector'},{key:'fc',label:"f'c (kg/cm2)",numeric:true},
  {key:'count',label:'Cant.',numeric:true},{key:'gross',label:'Bruto (m3)',numeric:true},{key:'deduction',label:'Solape (m3)',numeric:true},{key:'volume',label:'Neto (m3)',numeric:true},{key:'state',label:'Estado'},
  {key:'steel',label:'Acero manual (kg)',numeric:true},
  {key:'surface',label:'Encofrado (m2)',numeric:true},{key:'cost',label:'Costo (USD)',numeric:true},
];
export function scheduleCsv(rows:ScheduleRow[]):string {
  const cell=(v:unknown)=>{let s=String(v??''); if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const value=(r:ScheduleRow,key:keyof ScheduleRow)=>typeof r[key]==='number'?Number.isFinite(r[key] as number)?(r[key] as number).toFixed(['volume','gross','deduction'].includes(key)?3:['count','fc'].includes(key)?0:2):key==='fc'?'Varios':'No disponible':r[key];
  const totals=scheduleTotals(rows);
  return '\uFEFF'+[scheduleColumns.map(c=>cell(c.label)).join(','),...rows.map(r=>scheduleColumns.map(c=>cell(value(r,c.key))).join(',')),scheduleColumns.map(c=>cell(c.key==='mark'?'TOTAL':totals[c.key]!==undefined?Number.isFinite(totals[c.key])?totals[c.key]!.toFixed(c.key==='count'?0:['volume','gross','deduction'].includes(c.key)?3:2):'No disponible':'')).join(',')].join('\r\n');
}
export function scheduleTotals(rows:ScheduleRow[]):Partial<Record<keyof ScheduleRow,number>>{return Object.fromEntries(['count','gross','deduction','volume','steel','surface','cost'].map(key=>[key,rows.reduce((s,r)=>s+(r[key as keyof ScheduleRow] as number),0)]));}
