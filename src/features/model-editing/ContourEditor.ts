import { StructuralDefinition, SlabDefinition, Vector3D, quantities, validateDefinition } from '../../core/model/Geometry';
import { ManagedElement } from '../../tools/structural/types';
import { captureDefinition } from '../../tools/structural/ElementGeometry';
import { escapeHtml as h, icon, modalKeyboard } from '../../shared/ui/dom';
import { AxisConstraint, edgeNormal, slideEdge, translateDefinition } from '../../core/model/GeometryEditing';

export class ContourEditor {
  private overlay=document.createElement('div');
  private element!:ManagedElement; private draft!:StructuralDefinition;
  private ring=0; private vertex=0; private history:StructuralDefinition[]=[]; private future:StructuralDefinition[]=[];
  private drawing:'boundary'|'hole'|null=null; private pending:Vector3D[]=[]; private dragging=false;
  private drag: {kind:'vertex'|'edge'|'move';index:number;pointer:Vector3D;initial:StructuralDefinition;future:StructuralDefinition[]}|null=null;
  private constraint=new AxisConstraint();private ortho=false;private moving=false;
  private guide:{origin:Vector3D;direction:Vector3D}|null=null;private preview:Vector3D|null=null;private lastPointer:PointerEvent|null=null;
  private canvas!:HTMLCanvasElement; private scale=30; private cx=0; private cz=0;private w=0;private height=0;
  private previous:HTMLElement|null=null;private observer:ResizeObserver;
  constructor(private commit:(el:ManagedElement,definition:StructuralDefinition)=>void) {
    this.overlay.className='fixed inset-0 z-[200] hidden items-center justify-center overflow-auto bg-slate-950/70 p-2 md:p-5';this.overlay.id='contour-editor';this.overlay.hidden=true;
    this.overlay.setAttribute('role','dialog');this.overlay.setAttribute('aria-modal','true');this.overlay.setAttribute('aria-label','Editar contorno');
    document.body.append(this.overlay);modalKeyboard(this.overlay,()=>this.close());
    this.observer=new ResizeObserver(()=>{this.fit();this.paint();});
    for(const event of ['keydown','keyup'])this.overlay.addEventListener(event,e=>{
      const key=e as KeyboardEvent;
      if((key.key==='Control'||key.key==='Shift')&&this.lastPointer){const p=this.lastPointer;this.movePointer(new PointerEvent('pointermove',{clientX:p.clientX,clientY:p.clientY,ctrlKey:key.ctrlKey,shiftKey:key.shiftKey}));}
    });
  }
  public open(el:ManagedElement,addHole=false):void {
    this.previous=document.activeElement as HTMLElement;this.element=el;this.draft=structuredClone(captureDefinition(el));
    this.history=[];this.future=[];this.ring=0;this.vertex=0;this.pending=[];this.drawing=addHole?'hole':null;
    this.drag=null;this.dragging=false;this.moving=false;this.guide=null;this.preview=null;this.lastPointer=null;this.constraint.reset();
    this.overlay.hidden=false;this.overlay.classList.remove('hidden');this.overlay.classList.add('flex');this.render();this.fit();this.paint();this.get<HTMLButtonElement>('contour-finish').focus();
  }
  private close():void {this.overlay.hidden=true;this.overlay.classList.remove('flex');this.overlay.classList.add('hidden');this.observer.disconnect();this.previous?.focus();}
  private get<T extends HTMLElement>(id:string):T{return this.overlay.querySelector<T>('#'+id)!;}
  private saveUndo():void {this.history.push(structuredClone(this.draft));if(this.history.length>100)this.history.shift();this.future=[];}
  private points():Vector3D[]{
    const d=this.draft;
    if(d.type==='slab')return this.ring===0?d.boundary:(d.voids||[])[this.ring-1];
    if(d.type==='beam')return [d.startPoint,d.endPoint];if(d.type==='column')return [d.basePoint,d.topPoint];
    return [d.center];
  }
  private render():void {
    const slab=this.draft.type==='slab';
    this.overlay.innerHTML=`<section class="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden bg-white text-slate-800"><header class="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-3"><div><span class="text-xs font-semibold">MODIFICAR / ${h(this.element.bimDoc?.instanceParameters.mark||this.element.id)}</span><h2 class="text-lg font-semibold">${slab?'Editar contorno':'Editar geometria'}</h2></div><div class="flex flex-wrap items-center gap-2"><button id="contour-cancel" class="flex items-center gap-1 border px-2 py-1 text-xs">${icon('X')} Cancelar</button><button id="contour-finish" class="flex items-center gap-1 border px-2 py-1 text-xs">${icon('Check')} Finalizar</button></div></header>
    <div id="contour-toolbar" class="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 p-2"><button id="contour-undo" class="flex h-8 w-8 items-center justify-center border" title="Deshacer" aria-label="Deshacer">${icon('Undo2')}</button><button id="contour-redo" class="flex h-8 w-8 items-center justify-center border" title="Rehacer" aria-label="Rehacer">${icon('Redo2')}</button><button id="contour-fit" class="flex h-8 w-8 items-center justify-center border" title="Encuadrar" aria-label="Encuadrar">${icon('Crosshair')}</button>${slab?`<button id="contour-draw" class="border px-2 py-1 text-xs">${icon('Pencil')} Dibujar contorno</button><button id="contour-hole" class="border px-2 py-1 text-xs">${icon('Plus')} Dibujar hueco</button><button id="contour-close-ring" class="border px-2 py-1 text-xs">${icon('Check')} Cerrar trazo</button><button id="contour-discard-ring" class="border px-2 py-1 text-xs">${icon('X')} Descartar trazo</button>`:''}</div>
    <div class="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_300px]"><div class="relative min-h-[280px] overflow-hidden bg-slate-50"><canvas id="contour-canvas" class="absolute inset-0 h-full w-full touch-none" aria-label="Vista de geometria editable"></canvas></div><aside class="max-h-[35dvh] overflow-auto border-t border-slate-200 p-3 text-xs lg:max-h-[65dvh] lg:border-l lg:border-t-0"><div id="contour-params"></div><div id="contour-rings"></div><div class="overflow-auto"><table class="w-full border-collapse text-left [&_th]:p-1 [&_td]:p-1"><thead><tr><th>#</th><th>X (m)</th><th>${slab?'Z (m)':'Y (m)'}</th>${slab?'':'<th>Z (m)</th>'}<th></th></tr></thead><tbody id="contour-vertices"></tbody></table></div><div id="contour-error" class="py-2 text-sm" role="alert"></div></aside></div>
    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-xs"><span id="contour-status"></span><span id="contour-quantities"></span></footer></section>`;
    this.canvas=this.get<HTMLCanvasElement>('contour-canvas');this.observer.disconnect();this.observer.observe(this.canvas.parentElement!);
    if(slab){
      const move=document.createElement('button');move.id='contour-move';move.className='flex h-8 w-8 items-center justify-center border';move.title='Mover elemento completo';move.setAttribute('aria-label',move.title);move.innerHTML=icon('Move');move.setAttribute('aria-pressed','false');
      move.onclick=()=>{this.moving=!this.moving;this.drawing=null;this.pending=[];this.preview=null;this.guide=null;move.classList.toggle('bg-emerald-100',this.moving);move.setAttribute('aria-pressed',String(this.moving));this.refresh();};
      const ortho=document.createElement('label');ortho.className='flex items-center gap-1.5 text-xs';ortho.title='Restringir a un eje (Ctrl o Shift)';ortho.innerHTML=`<input id="contour-ortho" type="checkbox" ${this.ortho?'checked':''}/> Ortogonal`;
      ortho.querySelector('input')!.onchange=e=>{this.ortho=(e.target as HTMLInputElement).checked;this.constraint.reset();};
      this.overlay.querySelector('#contour-toolbar')!.append(move,ortho);
    }
    this.get('contour-cancel').onclick=()=>this.close();
    this.get('contour-finish').onclick=()=>{
      try{if(this.drawing)throw new Error('Cierra o descarta el trazo activo.');validateDefinition(this.draft);this.commit(this.element,structuredClone(this.draft));this.close();}
      catch(e){this.get('contour-error').textContent=(e as Error).message;}
    };
    this.get('contour-undo').onclick=()=>{const d=this.history.pop();if(d){this.future.push(this.draft);this.draft=d;this.ring=0;this.vertex=0;this.pending=[];this.drawing=null;this.refresh();}};
    this.get('contour-redo').onclick=()=>{const d=this.future.pop();if(d){this.history.push(this.draft);this.draft=d;this.ring=0;this.vertex=0;this.refresh();}};
    this.get('contour-fit').onclick=()=>{this.fit();this.paint();};
    if(slab){
      this.get('contour-draw').onclick=()=>this.startDrawing('boundary');
      this.get('contour-hole').onclick=()=>this.startDrawing('hole');
      this.get('contour-close-ring').onclick=()=>this.closeRing();
      this.get('contour-discard-ring').onclick=()=>{this.drawing=null;this.pending=[];this.preview=null;this.guide=null;this.refresh();};
    }
    this.canvas.onpointerdown=e=>{
      if(this.draft.type!=='slab'||e.button!==0)return;
      this.lastPointer=e;const p=this.unproject(e);
      if(this.drawing){if(this.pending.length>=3 && this.pixelDistance(p,this.pending[0])<12){this.closeRing();return;}this.pending.push(this.drawPoint(p,e));this.constraint.reset();this.preview=null;this.guide=null;this.refresh();return;}
      const hit=this.hitHandle(p);if(!hit)return;
      this.ring=hit.ring;this.vertex=hit.index;this.constraint.reset();
      this.drag={kind:hit.kind,index:hit.index,pointer:p,initial:structuredClone(this.draft),future:[...this.future]};
      this.saveUndo();this.dragging=true;this.canvas.setPointerCapture(e.pointerId);this.refresh();
    };
    this.canvas.onpointermove=e=>this.movePointer(e);
    this.canvas.onpointerup=e=>{if(this.dragging)this.movePointer(e);this.finishDrag(false,e.pointerId);};
    this.canvas.onpointercancel=e=>this.finishDrag(true,e.pointerId);
    this.refresh();
  }
  private startDrawing(mode:'boundary'|'hole'):void {
    this.moving=false;const b=this.get('contour-move');b.classList.remove('bg-emerald-100');b.setAttribute('aria-pressed','false');
    this.drawing=mode;this.pending=[];this.preview=null;this.guide=null;this.constraint.reset();this.refresh();
  }
  private center():Vector3D {
    const p=this.displayRings()[0];return {x:(Math.min(...p.map(v=>v.x))+Math.max(...p.map(v=>v.x)))/2,y:p[0].y,z:(Math.min(...p.map(v=>v.z))+Math.max(...p.map(v=>v.z)))/2};
  }
  private hitHandle(p:Vector3D):{kind:'vertex'|'edge'|'move';ring:number;index:number}|null {
    if(this.moving)return {kind:'move',ring:this.ring,index:0};
    const rings=this.displayRings();
    for(const [r,points] of rings.entries())for(const [i,v] of points.entries())if(this.pixelDistance(p,v)<12)return {kind:'vertex',ring:r,index:i};
    for(const [r,points] of rings.entries())for(const [i,a] of points.entries()){const b=points[(i+1)%points.length];if(this.pixelDistance(p,{x:(a.x+b.x)/2,y:a.y,z:(a.z+b.z)/2})<12)return {kind:'edge',ring:r,index:i};}
    return this.pixelDistance(p,this.center())<12?{kind:'move',ring:this.ring,index:0}:null;
  }
  private constrained(delta:Vector3D,origin:Vector3D,e:PointerEvent):Vector3D {
    const out=this.constraint.constrain(delta,this.ortho||e.ctrlKey||e.shiftKey);
    const axis=this.constraint.axis;this.guide=axis?{origin,direction:{x:axis==='x'?1:0,y:0,z:axis==='z'?1:0}}:null;return out;
  }
  private drawPoint(p:Vector3D,e:PointerEvent):Vector3D {
    const a=this.pending[this.pending.length-1];if(!a)return p;
    const delta=this.constrained({x:p.x-a.x,y:0,z:p.z-a.z},a,e);return {x:a.x+delta.x,y:a.y,z:a.z+delta.z};
  }
  private movePointer(e:PointerEvent):void {
    if(this.draft.type!=='slab')return;this.lastPointer=e;const p=this.unproject(e);
    if(this.drawing){this.preview=this.drawPoint(p,e);this.paint();return;}
    if(!this.drag){const hit=this.hitHandle(p);this.canvas.style.cursor=hit?'move':'default';this.canvas.title=hit?.kind==='edge'?'Desplazar borde paralelo':hit?.kind==='move'?'Mover elemento completo':hit?'Mover vertice (Ctrl: un eje)':'';return;}
    const drag=this.drag,initial=drag.initial as SlabDefinition;
    const points=this.ring===0?initial.boundary:initial.voids![this.ring-1];
    const delta={x:p.x-drag.pointer.x,y:0,z:p.z-drag.pointer.z};
    this.draft=structuredClone(initial);
    if(drag.kind==='move')this.draft=translateDefinition(initial,this.constrained(delta,drag.pointer,e));
    else if(drag.kind==='vertex'){
      const a=points[drag.index],d=this.constrained(delta,a,e);Object.assign(this.points()[drag.index],{x:a.x+d.x,y:a.y,z:a.z+d.z});
    }else{
      const a=points[drag.index],b=points[(drag.index+1)%points.length];
      this.guide={origin:{x:(a.x+b.x)/2,y:a.y,z:(a.z+b.z)/2},direction:edgeNormal(points,drag.index)};
      try{const shifted=slideEdge(points,drag.index,delta);if(this.ring===0)this.draft.boundary=shifted;else this.draft.voids![this.ring-1]=shifted;}
      catch(e){this.get('contour-error').textContent=(e as Error).message;}
    }
    this.paint();
  }
  private finishDrag(cancel:boolean,pointerId:number):void {
    if(!this.drag)return;
    if(cancel){this.draft=this.drag.initial;this.history.pop();this.future=this.drag.future;}
    this.drag=null;this.dragging=false;this.guide=null;this.constraint.reset();
    if(this.canvas.hasPointerCapture(pointerId))this.canvas.releasePointerCapture(pointerId);
    this.refresh();
  }
  private closeRing():void {
    if(this.draft.type!=='slab'||!this.drawing)return;
    const candidate=structuredClone(this.draft);
    if(this.drawing==='boundary')candidate.boundary=structuredClone(this.pending);else candidate.voids=[...(candidate.voids||[]),structuredClone(this.pending)];
    try{validateDefinition(candidate);this.saveUndo();this.draft=candidate;this.ring=this.drawing==='hole'?candidate.voids!.length:0;this.vertex=0;this.drawing=null;this.pending=[];this.preview=null;this.guide=null;this.refresh();}
    catch(e){this.get('contour-error').textContent=(e as Error).message;}
  }
  private refresh():void {
    const d=this.draft;
    const params:string[]=d.type==='slab'?['thickness','elevationY']:d.type==='beam'?['width','height']:d.type==='column'?['width','depth']:['width','length','height'];
    const labels:Record<string,string>={width:'Ancho (m)',height:'Peralte / alto (m)',depth:'Fondo (m)',length:'Largo (m)',thickness:'Espesor (m)',elevationY:'Cota inferior (m)'};
    this.get('contour-params').innerHTML=`<div class="grid grid-cols-2 gap-2">${params.map(k=>`<label class="flex flex-col gap-1">${labels[k]}<input class="w-full" type="number" step="0.01" data-param="${k}" value="${Number((d as unknown as Record<string,number>)[k].toFixed(6))}"/></label>`).join('')}</div>`;
    this.overlay.querySelectorAll<HTMLInputElement>('[data-param]').forEach(inp=>inp.onchange=()=>{this.saveUndo();(this.draft as unknown as Record<string,number>)[inp.dataset.param!]=inp.valueAsNumber;if(this.draft.type==='slab'&&inp.dataset.param==='elevationY')[this.draft.boundary,...(this.draft.voids||[])].flat().forEach(p=>p.y=this.draft.type==='slab'?this.draft.elevationY:p.y);this.refresh();});
    if(d.type==='slab'){
      this.get('contour-rings').innerHTML=`<label class="my-2 flex flex-col gap-1">Contorno<select id="contour-ring" class="w-full"><option value="0">Exterior</option>${(d.voids||[]).map((_,i)=>`<option value="${i+1}">Hueco ${i+1}</option>`).join('')}</select></label><div class="mb-3 flex flex-wrap gap-2"><button id="contour-insert" class="border px-2 py-1" title="Insertar vertice despues del seleccionado">${icon('Plus')} Vertice</button><button id="contour-remove-hole" class="border px-2 py-1" ${this.ring===0?'disabled':''}>${icon('Trash2')} Hueco</button></div>`;
      this.get<HTMLSelectElement>('contour-ring').value=String(this.ring);this.get<HTMLSelectElement>('contour-ring').onchange=e=>{this.ring=Number((e.target as HTMLSelectElement).value);this.vertex=0;this.refresh();};
      this.get('contour-insert').onclick=()=>{this.saveUndo();const p=this.points(),a=p[this.vertex],b=p[(this.vertex+1)%p.length];p.splice(this.vertex+1,0,{x:(a.x+b.x)/2,y:d.elevationY,z:(a.z+b.z)/2});this.vertex++;this.refresh();};
      this.get('contour-remove-hole').onclick=()=>{if(this.ring>0){this.saveUndo();d.voids!.splice(this.ring-1,1);this.ring=0;this.vertex=0;this.refresh();}};
    }
    const axes:('x'|'y'|'z')[]=d.type==='slab'?['x','z']:['x','y','z'];
    this.get('contour-vertices').innerHTML=this.points().map((p,i)=>`<tr class="${i===this.vertex?'bg-emerald-50':''}"><td>${i+1}</td>${axes.map(a=>`<td><input class="w-20" aria-label="Vertice ${i+1} ${a.toUpperCase()}" type="number" step="0.01" data-vertex="${i}" data-axis="${a}" value="${Number(p[a].toFixed(4))}" /></td>`).join('')}<td>${d.type==='slab'?`<button data-remove="${i}" class="flex h-7 w-7 items-center justify-center border" title="Eliminar vertice ${i+1}" aria-label="Eliminar vertice ${i+1}" ${this.points().length<=3?'disabled':''}>${icon('Minus')}</button>`:''}</td></tr>`).join('');
    this.overlay.querySelectorAll<HTMLInputElement>('[data-vertex]').forEach(inp=>{inp.onfocus=()=>{this.vertex=Number(inp.dataset.vertex);this.paint();};inp.onchange=()=>{this.saveUndo();this.points()[Number(inp.dataset.vertex)][inp.dataset.axis as 'x'|'y'|'z']=inp.valueAsNumber;if(d.type==='column')d.columnStyle=Math.hypot(d.topPoint.x-d.basePoint.x,d.topPoint.z-d.basePoint.z)>1e-6?'slanted':'vertical';this.refresh();};});
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>{this.saveUndo();this.points().splice(Number(b.dataset.remove),1);this.vertex=0;this.refresh();});
    this.get<HTMLButtonElement>('contour-undo').disabled=!this.history.length;this.get<HTMLButtonElement>('contour-redo').disabled=!this.future.length;
    this.get('contour-status').textContent=this.drawing?`${this.drawing==='hole'?'Hueco':'Contorno exterior'} / ${this.pending.length} vertices`:`${d.type==='slab'||d.type==='footing'?'PLANTA XZ':'ALZADO'} / Metros`;
    try{const q=quantities(d);this.get('contour-error').textContent='';this.get('contour-quantities').textContent=`${q.volume.toFixed(3)} m³ / ${q.surfaceArea.toFixed(2)} m²`;this.get<HTMLButtonElement>('contour-finish').disabled=!!this.drawing;}
    catch(e){this.get('contour-error').textContent=(e as Error).message;this.get<HTMLButtonElement>('contour-finish').disabled=true;}
    this.paint();
  }
  private displayRings():Vector3D[][]{
    const d=this.draft;if(d.type==='slab')return [d.boundary,...(d.voids||[])];
    if(d.type==='footing'){const {x,y,z}=d.center,w=d.width/2,l=d.length/2;return [[{x:x-w,y,z:z-l},{x:x+w,y,z:z-l},{x:x+w,y,z:z+l},{x:x-w,y,z:z+l}]];}
    const p=this.points();const alongX=Math.abs(p[1].x-p[0].x)>=Math.abs(p[1].z-p[0].z);
    return [p.map(v=>({x:alongX?v.x:v.z,y:0,z:-v.y}))];
  }
  private fit():void {
    const p=this.displayRings().flat().filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));if(!p.length)return;
    const xs=p.map(v=>v.x),zs=p.map(v=>v.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    this.cx=(minX+maxX)/2;this.cz=(minZ+maxZ)/2;const rect=this.canvas.getBoundingClientRect();
    this.scale=Math.min((rect.width-100)/Math.max(maxX-minX,2),(rect.height-100)/Math.max(maxZ-minZ,2));
  }
  private project(p:Vector3D):[number,number]{return [this.w/2+(p.x-this.cx)*this.scale,this.height/2+(p.z-this.cz)*this.scale];}
  private unproject(e:PointerEvent):Vector3D{const r=this.canvas.getBoundingClientRect();return {x:Math.round(((e.clientX-r.left-this.w/2)/this.scale+this.cx)*100)/100,y:this.draft.type==='slab'?this.draft.elevationY:0,z:Math.round(((e.clientY-r.top-this.height/2)/this.scale+this.cz)*100)/100};}
  private pixelDistance(a:Vector3D,b:Vector3D):number{return Math.hypot(a.x-b.x,a.z-b.z)*this.scale;}
  private paint():void {
    if(!this.canvas||this.overlay.hidden)return;const r=this.canvas.getBoundingClientRect();this.w=r.width;this.height=r.height;
    const ratio=window.devicePixelRatio||1;this.canvas.width=r.width*ratio;this.canvas.height=r.height*ratio;const ctx=this.canvas.getContext('2d')!;ctx.scale(ratio,ratio);ctx.clearRect(0,0,r.width,r.height);
    ctx.strokeStyle='#e1e7e9';ctx.lineWidth=1;const step=Math.max(20,this.scale);
    for(let x=(this.w/2-this.cx*this.scale)%step;x<this.w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,this.height);ctx.stroke();}
    for(let y=(this.height/2-this.cz*this.scale)%step;y<this.height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.w,y);ctx.stroke();}
    const rings=this.displayRings();
    rings.forEach((ring,index)=>{
      if(!ring.length||ring.some(p=>![p.x,p.z].every(Number.isFinite)))return;
      ctx.beginPath();ring.forEach((p,i)=>{const [x,y]=this.project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      if(ring.length>2)ctx.closePath();ctx.fillStyle=index?'#f6f8f9':'#d8e9e2';if(ring.length>2)ctx.fill();ctx.strokeStyle=index===this.ring?'#b42f87':'#657f88';ctx.lineWidth=2;ctx.stroke();
      ring.forEach((p,i)=>{const [x,y]=this.project(p);ctx.fillStyle=index===this.ring&&i===this.vertex?'#b42f87':'#fff';ctx.fillRect(x-4,y-4,8,8);ctx.strokeRect(x-4,y-4,8,8);ctx.fillStyle='#304a55';ctx.font='11px Arial';ctx.fillText(String(i+1),x+8,y-8);});
      if(this.draft.type==='slab'&&!this.drawing)ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];if(Math.hypot(b.x-a.x,b.z-a.z)<.001)return;const [x,y]=this.project({x:(a.x+b.x)/2,y:a.y,z:(a.z+b.z)/2});const normal=edgeNormal(ring,i);ctx.strokeStyle='#167253';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-normal.x*7,y-normal.z*7);ctx.lineTo(x+normal.x*7,y+normal.z*7);ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(x-3,y-3,6,6);ctx.strokeRect(x-3,y-3,6,6);});
    });
    if(this.draft.type==='slab'&&!this.drawing){const [x,y]=this.project(this.center());ctx.strokeStyle='#176e91';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-9,y);ctx.lineTo(x+9,y);ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);ctx.stroke();ctx.strokeRect(x-3,y-3,6,6);}
    if(this.guide){const {origin,direction}=this.guide,[x,y]=this.project(origin);ctx.save();ctx.strokeStyle='#168baa';ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(x-direction.x*2000,y-direction.z*2000);ctx.lineTo(x+direction.x*2000,y+direction.z*2000);ctx.stroke();ctx.restore();}
    if(this.pending.length){ctx.strokeStyle='#c67e14';ctx.lineWidth=2;ctx.beginPath();this.pending.forEach((p,i)=>{const [x,y]=this.project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();this.pending.forEach(p=>{const [x,y]=this.project(p);ctx.fillStyle='#c67e14';ctx.fillRect(x-4,y-4,8,8);});}
    if(this.preview&&this.pending.length){ctx.save();ctx.strokeStyle='#c67e14';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(...this.project(this.pending[this.pending.length-1]));ctx.lineTo(...this.project(this.preview));ctx.stroke();ctx.restore();}
  }
}
