import { AnalysisModel, AnalysisResult } from './Model';
import type { BenchmarkId } from './Benchmarks';
import { benchmarkComparison } from './BenchmarkReport';
import {buildLoadLedger,type LoadLedger} from './LoadLedger';
import {frameInputSignature} from './Loads';
import {assessAnalysisResult} from './ResultAssessment';
import type {KernelParityReport} from './KernelAdapter';
import {kernelDiagnosticRows,kernelDiagnosticsScope,kernelDiagnosticsUnavailable} from './KernelDiagnostics';
const h=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function analysisReport(model:AnalysisModel,result:AnalysisResult,factors:{dead:number;live:number;nodal:number},image:string,benchmark?:BenchmarkId,ledger?:LoadLedger,parity?:KernelParityReport|null):string {
  const table=(heads:string[],rows:(string|number)[][])=>`<table><thead><tr>${heads.map(v=>`<th>${h(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${h(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const balance=ledger??buildLoadLedger(model,factors,[],result),totals=balance.assembled.totals;
  if(result.inputSignature!==frameInputSignature(model,factors)||balance.inputSignature!==result.inputSignature)throw new Error('Resultados o balance no vigentes para esta memoria.');
  const assessment=assessAnalysisResult(model,result,factors,benchmark,parity);
  const parityRows=parity?[
    ['Nudos y reacciones',parity.rows],['Fuerzas de extremo',parity.memberRows],
    ['Diagramas',parity.diagramRows],['Deformada entre nudos',parity.deformationRows],
  ] as const:[];
  return `<!doctype html><html lang="es"><meta charset="UTF-8"><title>ARM - Memoria de analisis</title><style>body{font:12px Arial;color:#202b34;max-width:1000px;margin:40px auto;padding:20px}h1{font-size:25px}h2{font-size:16px;margin-top:26px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{padding:6px;border:1px solid #ccc;text-align:right;overflow-wrap:anywhere}th{background:#edf3f0}img{max-width:100%}@media print{body{margin:0;padding:0}thead{display:table-header-group}tr{break-inside:avoid}}@page{size:A4 landscape;margin:14mm}</style><h1>ARM / Memoria de analisis de portico</h1>
  <p>${h(result.caseName)} / ${new Date().toISOString()} / Revision ${result.revision}</p><p>${h(result.engine)}. Plano ${model.plane}; coordenada ${model.ordinate} m; tolerancia ${model.tolerance} m. Unidades: m, kN, MPa.</p>
  <p>Factores D=${factors.dead}, L=${factors.live}, nodal=${factors.nodal}. PP automatico incluido en D salvo tramos declarados como D total con PP. Cargas distribuidas positivas hacia abajo; Fy positiva hacia arriba; momento y giro positivos horarios en el plano H-Y. Losas: solo reparto uniforme declarado, no analisis de placas ni distribucion automatica. No incluye cimentaciones, segundo orden, sismo E.030 ni diseno de armaduras E.060. No acredita cumplimiento integral del RNE.</p><p>Elementos omitidos: ${model.omitted}. Ajustes de conectividad: ${h(model.issues.join(' '))}</p><img alt="Modelo y deformada" src="${image}"/>
  ${benchmark?benchmarkComparison(benchmark,model,factors,result):''}
  <h2>Lectura tecnica del resultado</h2><p>Coherente significa que paso las comprobaciones indicadas; no equivale a seguridad estructural, capacidad, servicio ni conformidad normativa. La auditoria de reacciones recalcula el balance a partir de las cargas ensambladas y las reacciones entregadas; comparte el modelo de cargas del solver.</p>
  ${table(['Comprobacion','Estado','Interpretacion'],assessment.map(item=>[item.label,item.state==='coherent'?'Coherente':item.state==='review'?'Revisar':'No verificado',item.explanation]))}
  <h2>Contraste ARM / Rust</h2><p>${parity
    ? h(parity.deformationAvailable?'Se contrastaron respuestas, esfuerzos, diagramas y deformadas.':'Contraste incompleto: el kernel no entrego deformadas entre nudos.')
    : 'No se ejecuto el contraste Rust/WASM para esta revision.'} La coincidencia entre motores no constituye validacion independiente frente a un problema fisico conocido.</p>
  ${parity?table(['Grupo','Registros','Fuera de tolerancia','Lectura'],parityRows.map(([label,rows])=>[
    label,rows.length,rows.filter(row=>!row.passed).length,
    !rows.length?'No disponible':rows.every(row=>row.passed)?'Dentro de tolerancia':'Revisar diferencias en tabla interactiva',
  ])):''}
  ${parity?`<h2>Diagnostico numerico Rust</h2><p>${h(kernelDiagnosticsScope)}</p>${parity.diagnostics
    ?table(['Indicador','Valor','Interpretacion'],kernelDiagnosticRows(parity.diagnostics).map(row=>[row.label,row.value,row.explanation]))
    :`<p>${h(kernelDiagnosticsUnavailable)}</p>`}`:''}
  <h2>Balance de cargas</h2><p>${h(balance.scope)}</p>${table(['PP automatico activo (kN)','PP automatico excluido (kN)','D manual (kN)','L manual (kN)','Fx del caso (kN)','Fy del caso (kN)','M global horario (kN m)'],[[totals.selfWeight,totals.excludedSelfWeight,totals.manualDead,totals.manualLive,totals.fx,totals.fy,totals.moment]])}
  <p>${balance.rows.filter(r=>r.status==='transfer-pending').length} losas sin transferencia BIM vinculada. Cargas manuales pueden representar losas u otras acciones, pero no hay una asignacion de fuentes verificada. La conciliacion de volumen bruto/neto no modifica el peso del solver.</p>
  <h2>Fuentes superficiales declaradas</h2><p>D superficial asignada: ${totals.surfaceDead} kN; L superficial asignada: ${totals.surfaceLive} kN. Area geometrica con huecos, sin descuento de solapes; D = area x (espesor x peso unitario + D sobrepuesta). La fuerza asignada se conserva; no se comprueba el momento de la fuente ni la compatibilidad espacial. La parte fuera del portico no ingresa al solver.</p>
  ${table(['Losa GUID','Area (m2)','Espesor (m)','Peso unitario (kN/m3)','D sobrepuesta / L (kN/m2)','D / L total (kN)','D / L asignada (kN)','D / L fuera (kN)','D / L pendiente (kN)','Sustento / fuera'],balance.assembled.surfaces.map(s=>[s.sourceId,s.area,s.thickness,s.unitWeight,s.additionalDead+' / '+s.surfaceLive,s.dead+' / '+s.live,s.assignedDead+' / '+s.assignedLive,s.outsideDead+' / '+s.outsideLive,s.pendingDead+' / '+s.pendingLive,s.reference+' / '+s.outsideReference]))}
  ${table(['Losa / viga GUID','Tramos','Fraccion','D / L transferida (kN)','q D / L (kN/m)'],balance.assembled.surfaces.flatMap(s=>s.allocations.map(a=>[s.sourceId+' / '+a.receiverId,a.memberIds.join(', '),a.fraction,a.dead+' / '+a.live,a.qDead+' / '+a.qLive])))}
  ${table(['Nivel BIM de origen','PP activo (kN)','D manual (kN)','L manual (kN)','Caso descendente (kN)','Losas pendientes'],balance.levels.map(l=>[l.level,l.selfWeight,l.manualDead,l.manualLive,l.downward,l.pending]))}
  ${table(['Tramo / GUID','Declaracion D','PP activo (kN)','PP excluido (kN)','D manual (kN)','L manual (kN)','Referencia manual'],balance.assembled.members.map(m=>[m.id+' / '+m.sourceId,m.deadLoadMode==='includes-self-weight'?'D total incluye PP':'D adicional',m.selfWeight,m.excludedSelfWeight,m.manualDead,m.manualLive,m.reference||'Sin referencia']))}
  <h2>Nudos, apoyos y cargas</h2>${table(['ID','H (m)','Y (m)','Apoyo','Fh (kN)','Fy (kN)','M (kN m)'],model.nodes.map(n=>[n.id,n.x,n.y,n.support,n.fx,n.fy,n.moment]))}
  <h2>Barras y trazabilidad BIM</h2><p>Generacion geometrica: ${h(model.geometryVersion??'Modelo manual o legado')}. Los rangos indican la fraccion del eje del elemento original; cada fila es un tramo FEM. Las intersecciones no implican brazos rigidos ni diafragmas.</p>${table(['Marca / GUID / version','Tramo / rango de origen','Nudos','A (m2)','I (m4)','E (MPa)','Peso (kN/m)','D (kN/m)','L (kN/m)','Art. I/J'],model.members.map(m=>[m.mark+' / '+m.sourceId+' / v'+model.sourceVersions[m.sourceId],m.id+' / '+(m.sourceRange?.map(t=>(t*100).toFixed(2)+'%').join(' - ')??'No registrado'),m.start+' / '+m.end,m.area,m.inertia,m.elasticModulusMPa,m.weight,m.dead,m.live,`${m.releaseStart}/${m.releaseEnd}`]))}
  <h2>Desplazamientos y reacciones</h2>${table(['Nudo','Uh (mm)','Uy (mm)','Giro (rad)','Rh (kN)','Ry (kN)','Rm (kN m)'],result.nodes.map(n=>[n.id,(n.ux*1000).toFixed(5),(n.uy*1000).toFixed(5),n.rotation.toExponential(4),n.rx.toFixed(4),n.ry.toFixed(4),n.rm.toFixed(4)]))}
  <h2>Envolvente absoluta del caso (21 estaciones por barra)</h2>${table(['Barra','|N|max (kN)','|V|max (kN)','|M|max (kN m)'],result.members.map(m=>[model.members.find(b=>b.id===m.id)!.mark,Math.max(...m.axial.map(Math.abs)).toFixed(4),Math.max(...m.shear.map(Math.abs)).toFixed(4),Math.max(...m.moment.map(Math.abs)).toFixed(4)]))}<p>Residuo relativo de equilibrio de fuerzas: ${result.residual.toExponential(4)}</p>
  <h2>Referencias del proyecto</h2><p><a href="https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne">RNE: E.020, E.030 y E.060</a>. Motor <a href="https://github.com/janvorisek/ts-fem">ts-fem 0.2.0 (GPL-3.0)</a>.</p></html>`;
}
