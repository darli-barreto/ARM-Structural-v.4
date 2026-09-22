import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Viewer } from '../core/Viewer';
import { BimView } from '../core/views/BimView';
import { BimDatabase } from '../core/database/BimDatabase';
import { ElementRegistry } from '../tools/structural/ElementRegistry';
import { SelectionManager } from '../tools/SelectionManager';
import { PhysicalModelController } from '../core/model/PhysicalModelController';
import { analyticalGraph } from '../core/analysis/AnalyticalGraph';
import { FrameView, frameDocuments, segmentInFrame } from '../core/analysis/FrameView';
import { reinforcementLedger, rebarPaths, RebarSpec } from '../core/model/Reinforcement';
import { AnalysisPanel } from './AnalysisPanel';
import {assembleFrameLoads} from '../core/analysis/Loads';
import { icon, modalKeyboard } from './shared';
import './dual-model.css';

function dispose(group:THREE.Object3D){
  group.traverse(o=>{const mesh=o as THREE.Mesh;mesh.geometry?.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());});group.clear();
}
export class DualModelController {
  private scene=new THREE.Scene();
  private content=new THREE.Group();private steel=new THREE.Group();
  private toolbar=document.createElement('div');private info=document.createElement('div');
  private physical:PhysicalModelController;
  private revision=-1;private analysisVersion=-1;private dirty=true;private selected='';
  private paired=false;private scope='axes';private diagram='none';
  private pairPrimary='view-3d';
  private nodes=true;private supports=true;private loads=true;private transparent=false;private showSteel=false;
  private isolateSelected=false;
  private frame:FrameView={plane:'all',ordinate:0};private slabContours=false;
  private bars:THREE.Line[]=[];private rebarError='';private analyticalStatus='';
  private graphTolerance():number {
    const state=this.analysis.getVisualization(),model=state.model;
    return model&&!state.stale&&model.plane===this.frame.plane&&model.ordinate===this.frame.ordinate?model.tolerance:.001;
  }
  constructor(private viewer:Viewer,private registry:ElementRegistry,private selection:SelectionManager,private analysis:AnalysisPanel,private onMode:()=>void){
    this.scene.background=new THREE.Color('#f4f7f8');this.scene.add(this.content);viewer.scene.add(this.steel);
    this.physical=new PhysicalModelController(registry,()=>{
      selection.refreshHighlight();const p=selection.selectedElement?.bimDoc?.instanceParameters;if(!p)return;
      for(const [id,value] of [['prop-net-volume',p.volume.toFixed(3)+' m3'],['prop-gross-overlap',`${p.grossVolume?.toFixed(3)} / ${p.overlapVolume?.toFixed(3)}`],['prop-steel-mass',p.steelMass?.toFixed(2)??'No definido'],['prop-net-cost','$'+p.estimatedCost.toFixed(2)]]){const field=document.getElementById(id);if(field)field.textContent=value;}
    });
    this.toolbar.id='model-toolbar';this.toolbar.innerHTML=`<div class="model-segment"><button id="model-physical" title="Modelo fisico">${icon('Box')} Fisico</button><button id="model-analytical" title="Modelo analitico">${icon('Network')} Analitico</button></div><select id="model-projection" aria-label="Proyeccion"><option value="3d">3D</option><option value="plan">Planta</option><option value="elevation">Frontal</option></select><button id="model-fit" class="icon-button" title="Encuadrar modelo" aria-label="Encuadrar modelo">${icon('Maximize')}</button><label><input id="model-sync" type="checkbox"> Comparar</label><select id="model-scope" aria-label="Alcance analitico"><option value="axes">Ejes neutros 3D</option><option value="calculation">Plano de calculo 2D</option></select><label><input id="model-nodes" type="checkbox" checked>Nudos</label><label><input id="model-supports" type="checkbox" checked>Apoyos</label><label><input id="model-loads" type="checkbox" checked>Cargas</label><select id="model-diagram" aria-label="Diagrama"><option value="none">Sin diagrama</option><option value="axial">Axial N (kN)</option><option value="shear">Cortante V (kN)</option><option value="moment">Momento M (kN m)</option><option value="deformation">Deformada</option></select><button id="model-calculate" title="Configurar y calcular portico">${icon('Calculator')}</button><label><input id="model-transparent" type="checkbox">Transparente</label><label><input id="model-steel" type="checkbox">Armadura</label><button id="model-rebar" title="Armadura manual del elemento" aria-label="Armadura manual del elemento">${icon('Settings2')}</button>`;
    const workspace=document.getElementById('app-workspace')!;workspace.prepend(this.toolbar);this.info.id='model-status';this.info.setAttribute('role','status');workspace.append(this.info);
    this.toolbar.insertAdjacentHTML('beforeend','<label><input id="model-isolate" type="checkbox">Aislar seleccion</label>');
    this.get<HTMLSelectElement>('model-scope').options[0].text='Ejes geometricos';
    this.get('model-scope').insertAdjacentHTML('afterend','<span id="model-geometry-options"><select id="model-frame-plane" aria-label="Portico geometrico" title="Filtro visual, no modifica el modelo de calculo"><option value="all">Todos los porticos</option><option value="XY">Portico X-Y</option><option value="ZY">Portico Z-Y</option></select><label id="model-frame-coordinate"><span id="model-frame-axis">Z (m)</span><input id="model-frame-ordinate" aria-label="Coordenada del portico (m)" type="number" step="0.001" value="0" disabled></label><label title="Contornos medios de losas, no barras FEM"><input id="model-slab-contours" type="checkbox">Contornos de losas</label></span>');
    this.get<HTMLSelectElement>('model-frame-plane').onchange=e=>{
      this.frame.plane=(e.target as HTMLSelectElement).value as FrameView['plane'];this.dirty=true;
      this.get<HTMLInputElement>('model-frame-ordinate').disabled=this.frame.plane==='all';
      this.get('model-frame-axis').textContent=this.frame.plane==='ZY'?'X (m)':'Z (m)';
      if(this.frame.plane!=='all')this.projection('elevation');else this.fit();
    };
    this.get<HTMLInputElement>('model-frame-ordinate').onchange=e=>{
      const input=e.target as HTMLInputElement;if(!Number.isFinite(input.valueAsNumber)){input.value=String(this.frame.ordinate);return;}
      this.frame.ordinate=input.valueAsNumber;this.dirty=true;this.fit();
    };
    this.get<HTMLInputElement>('model-slab-contours').onchange=e=>{this.slabContours=(e.target as HTMLInputElement).checked;this.dirty=true;};
    this.get<HTMLInputElement>('model-isolate').onchange=e=>{this.isolateSelected=(e.target as HTMLInputElement).checked;this.dirty=true;};
    for(const event of ['pointerdown','pointermove','pointerup','click','dblclick'])this.toolbar.addEventListener(event,e=>e.stopPropagation());
    const button=(id:string,fn:()=>void)=>this.get(id).onclick=fn;
    button('model-physical',()=>this.setMode('physical'));button('model-analytical',()=>this.setMode('analytical'));
    button('model-fit',()=>this.fit());button('model-calculate',()=>analysis.open());button('model-rebar',()=>this.editRebar());
    this.get<HTMLSelectElement>('model-projection').onchange=e=>this.projection((e.target as HTMLSelectElement).value as BimView['type']);
    this.get<HTMLInputElement>('model-sync').onchange=e=>this.compare((e.target as HTMLInputElement).checked);
    this.get<HTMLSelectElement>('model-scope').onchange=e=>{this.scope=(e.target as HTMLSelectElement).value;this.dirty=true;if(this.scope==='axes'){this.diagram='none';this.get<HTMLSelectElement>('model-diagram').value='none';}this.fit();};
    this.get<HTMLSelectElement>('model-diagram').onchange=e=>{this.diagram=(e.target as HTMLSelectElement).value;if(this.diagram!=='none'){this.scope='calculation';this.get<HTMLSelectElement>('model-scope').value=this.scope;this.setMode('analytical');this.fit();}this.dirty=true;};
    for(const [id,key] of [['model-nodes','nodes'],['model-supports','supports'],['model-loads','loads'],['model-transparent','transparent'],['model-steel','showSteel']] as const)this.get<HTMLInputElement>(id).onchange=e=>{this[key]=(e.target as HTMLInputElement).checked;this.dirty=true;};
    viewer.viewManager.sceneForView=view=>this.render(view);
    selection.pickOverride=e=>{
      const view=viewer.viewManager.getActiveView();if(view.modelMode!=='analytical')return undefined;
      const rect=view.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.params.Line={threshold:.15};ray.setFromCamera(new THREE.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),view.camera);
      const hit=ray.intersectObjects(this.bars).find(h=>h.object.userData.sourceId);return hit?registry.findById(hit.object.userData.sourceId)||null:null;
    };
    // Keep analytical interaction read-only except for linked element selection.
    document.getElementById('viewports-container')!.addEventListener('pointerdown',e=>{
      const panel=(e.target as HTMLElement).closest<HTMLElement>('[data-view-id]');if(panel)viewer.viewManager.setActiveView(panel.dataset.viewId!);
      if(viewer.viewManager.getActiveView().modelMode==='analytical')e.stopPropagation();
    });
    document.getElementById('viewports-container')!.addEventListener('click',e=>{
      if(viewer.viewManager.getActiveView().modelMode!=='analytical')return;
      e.stopPropagation();if(!selection.handlePointerClick(e))selection.clearSelection();
    });
  }
  private get<T extends HTMLElement=HTMLElement>(id:string){return this.toolbar.querySelector<T>('#'+id)!;}
  private setMode(mode:BimView['modelMode']){this.onMode();const view=this.viewer.viewManager.getActiveView();view.modelMode=mode;if(this.paired){const other=this.viewer.viewManager.getOpenViews().find(v=>v!==view);if(other)other.modelMode=mode==='physical'?'analytical':'physical';}this.dirty=true;}
  private compare(enabled:boolean):void{
    const vm=this.viewer.viewManager;this.paired=enabled;
    if(enabled){
      const source=vm.getActiveView();let other=vm.views.get('dual-peer');
      if(source.id==='dual-peer'){vm.setActiveView('view-3d');return this.compare(true);}
      this.pairPrimary=source.id;
      if(!other){other=new BimView('dual-peer','Modelo vinculado',source.type,document.getElementById('viewports-container')!,this.viewer.renderer.domElement);vm.views.set(other.id,other);other.domElement.addEventListener('pointerdown',()=>vm.setActiveView(other!.id));}
      other.modelMode=source.modelMode==='physical'?'analytical':'physical';other.camera=source.camera.clone();other.controls.object=other.camera;other.type=source.type;other.controls.enableRotate=source.type==='3d';other.controls.target.copy(source.controls.target);other.frustumSize=source.frustumSize;
      vm.openTabIds=[source.id,other.id];vm.setLayout(window.innerWidth<700?'split-h':'split-v');vm.setActiveView(source.id);
    }else{vm.openTabIds=[vm.activeViewId];vm.setLayout('single');vm.setActiveView(vm.activeViewId);}
  }
  private projection(type:BimView['type']){
    const vm=this.viewer.viewManager,source=vm.getActiveView(),mode=source.modelMode,id=type==='3d'?'view-3d':`dual-${type}`;
    let view=vm.views.get(id);
    if(!view){view=new BimView(id,type==='plan'?'Planta general':'Frontal general',type,document.getElementById('viewports-container')!,this.viewer.renderer.domElement);vm.views.set(id,view);view.domElement.addEventListener('pointerdown',()=>vm.setActiveView(id));}
    view.modelMode=mode;vm.openView(id);this.fit();if(this.paired)this.compare(true);
  }
  private fit(){
    const view=this.viewer.viewManager.getActiveView(),box=new THREE.Box3(),model=this.analysis.getVisualization().model;
    const analytical=view.modelMode==='analytical',plane=this.scope==='axes'?this.frame.plane:model?.plane;
    if(analytical){
      const points=this.scope==='axes'?analyticalGraph(frameDocuments(BimDatabase.getInstance().getAllElements(),this.frame),this.graphTolerance()).nodes.map(n=>n.point):model?.nodes.map(n=>model.plane==='XY'?new THREE.Vector3(n.x,n.y,model.ordinate):new THREE.Vector3(model.ordinate,n.y,n.x))||[];
      points.forEach(p=>box.expandByPoint(p));
    }else this.registry.getAll().forEach(e=>{if((!this.isolateSelected||!this.selection.selectedElement||e===this.selection.selectedElement)&&e.mesh.geometry.getAttribute('position').count)box.expandByObject(e.mesh);});
    const center=box.isEmpty()?view.controls.target.clone():box.getCenter(new THREE.Vector3()),size=box.isEmpty()?new THREE.Vector3(10,10,10):box.getSize(new THREE.Vector3()),distance=Math.max(size.length()*1.6,8);
    const side=analytical&&plane==='ZY';
    const dir=view.type==='plan'?new THREE.Vector3(0,1,0):view.type==='elevation'?(side?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1)):new THREE.Vector3(1,.75,1).normalize();
    const rect=view.domElement.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
    const width=view.type==='elevation'?(side?size.z:size.x):size.x,height=view.type==='plan'?size.z:size.y;
    view.controls.target.copy(center);view.camera.position.copy(center).addScaledVector(dir,distance);view.camera.lookAt(center);view.frustumSize=Math.max(height,width/aspect,1)*1.35;view.camera.updateMatrixWorld();view.controls.update();
  }
  private line(points:THREE.Vector3[],color:number,sourceId?:string){
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color}));line.userData={sourceId,baseColor:color};this.content.add(line);if(sourceId)this.bars.push(line);return line;
  }
  private pointCloud(points:THREE.Vector3[]){if(this.nodes&&points.length)this.content.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(points),new THREE.PointsMaterial({color:0xa9337c,size:5,sizeAttenuation:false})));}
  private rebuild(){
    this.selected='';
    dispose(this.content);dispose(this.steel);this.bars=[];
    const docs=BimDatabase.getInstance().getAllElements(),state=this.analysis.getVisualization();
    if(this.scope==='axes'){
      const filtered=frameDocuments(docs,this.frame),graph=analyticalGraph(filtered,this.graphTolerance()),nodes=new Map(graph.nodes.map(n=>[n.id,n.point]));
      graph.members.forEach(m=>this.line([nodes.get(m.start)!,nodes.get(m.end)!],0x167b75,m.sourceId));this.pointCloud(graph.nodes.map(n=>n.point));
      let contours=0;
      if(this.slabContours)docs.forEach(d=>{const g=d.geometry.definition;if(g.type==='slab')[g.boundary,...(g.voids||[])].forEach(r=>r.forEach((p,i)=>{
        const a=new THREE.Vector3(p.x,g.elevationY+g.thickness/2,p.z),q=r[(i+1)%r.length],b=new THREE.Vector3(q.x,g.elevationY+g.thickness/2,q.z);
        if(segmentInFrame(a,b,this.frame)){this.line([a,b],0x84949f,d.uniqueId);contours++;}
      }));});
      const location=this.frame.plane==='all'?'Todos los porticos':`${this.frame.plane} / ${this.frame.plane==='XY'?'Z':'X'} = ${this.frame.ordinate} m`;
      this.analyticalStatus=`Ejes centroidales sin resultados FEM | ${location} | ${filtered.length} elementos / ${graph.nodes.length} nudos / ${graph.members.length} tramos | Union ${this.graphTolerance()} m${graph.collapsed.length?' | Tramos colapsados: reducir tolerancia':''}${filtered.length?'':' | Sin barras en este plano'}${this.slabContours?' | Contornos de losas, no shells':''}`;
      this.info.dataset.axisElements=String(filtered.length);this.info.dataset.slabContours=String(contours);
      this.info.dataset.axisNodes=String(graph.nodes.length);this.info.dataset.axisSegments=String(graph.members.length);
    }else if(state.model){
      const model=state.model,point=(x:number,y:number)=>model.plane==='XY'?new THREE.Vector3(x,y,model.ordinate):new THREE.Vector3(model.ordinate,y,x),nodes=new Map(model.nodes.map(n=>[n.id,point(n.x,n.y)]));
      this.info.dataset.calculationNodes=String(model.nodes.length);this.info.dataset.calculationSegments=String(model.members.length);
      const extent=Math.max(2,new THREE.Box3().setFromPoints([...nodes.values()]).getSize(new THREE.Vector3()).length()),symbol=extent*.012;
      model.members.forEach(m=>this.line([nodes.get(m.start)!,nodes.get(m.end)!],state.stale?0x999999:0x167b75,m.sourceId));this.pointCloud([...nodes.values()]);
      const arrow=(at:THREE.Vector3,direction:THREE.Vector3,length:number,color:number)=>this.content.add(new THREE.ArrowHelper(direction.clone().normalize(),at,length,color,length*.22,length*.1));
      model.nodes.forEach(n=>{
        const p=nodes.get(n.id)!;
        if(this.supports&&n.support!=='free'){
          const x=(a:number,b:number)=>p.clone().add(point(a,b).sub(point(0,0)));
          this.line([x(-symbol,-symbol),x(symbol,-symbol),p,x(-symbol,-symbol)],n.support==='fixed'?0x334e8c:0x81439b);
          if(n.support==='fixed')for(let i=-2;i<=2;i++)this.line([x(i*symbol/2,-symbol),x((i-.5)*symbol/2,-1.5*symbol)],0x334e8c);
          if(n.support==='roller')this.line([x(-symbol,-1.4*symbol),x(symbol,-1.4*symbol)],0x81439b);
        }
        if(this.loads){
          const f=point(n.fx*state.factors.nodal,n.fy*state.factors.nodal).sub(point(0,0));if(f.length()>0)arrow(p.clone().addScaledVector(f.clone().normalize(),-symbol*4),f,symbol*4,0xc44532);
          if(n.moment*state.factors.nodal!==0){const s=Math.sign(n.moment*state.factors.nodal),r=symbol*2;this.line(Array.from({length:21},(_,i)=>p.clone().add(point(r*Math.cos(s*i*Math.PI*1.5/20),r*Math.sin(s*i*Math.PI*1.5/20)).sub(point(0,0)))),0xc44532);arrow(p.clone().add(point(0,-s*r).sub(point(0,0))),point(s,0).sub(point(0,0)),symbol,0xc44532);}
        }
      });
      let loadError='';const lineLoads=new Map<string,number>();
      try{assembleFrameLoads(model,state.factors,false).members.forEach(m=>lineLoads.set(m.id,m.lineLoad));}catch(error){loadError=(error as Error).message;}
      model.members.forEach(m=>{
        const a=nodes.get(m.start)!,b=nodes.get(m.end)!,q=lineLoads.get(m.id)??0;
        if(this.loads&&q!==0)for(let i=1;i<=4;i++){const p=a.clone().lerp(b,i/5);arrow(p.clone().add(new THREE.Vector3(0,Math.sign(q)*symbol*4,0)),new THREE.Vector3(0,-Math.sign(q),0),symbol*4,0xc44532);}
      });
      let diagramText=loadError;
      if(state.result&&this.diagram!=='none'){
        const results=state.result.members;
        const maximum=Math.max(1e-12,...results.flatMap(m=>this.diagram==='deformation'?m.deflectionX.map((x,i)=>Math.hypot(x,m.deflectionY[i])):m[this.diagram as 'axial'|'shear'|'moment'].map(Math.abs)));
        const scale=extent*.12/maximum;
        results.forEach(r=>{
          const member=model.members.find(m=>m.id===r.id)!;const a=nodes.get(member.start)!,b=nodes.get(member.end)!,length=a.distanceTo(b),direction=b.clone().sub(a).normalize();
          const normal=model.plane==='XY'?new THREE.Vector3(-direction.y,direction.x,0):new THREE.Vector3(0,direction.z,-direction.y);
          const points=r.stations.map((s,i)=>{
            const p=a.clone().lerp(b,s/length);
            return this.diagram==='deformation'?p.add(point(r.deflectionX[i]*scale,r.deflectionY[i]*scale).sub(point(0,0))):p.addScaledVector(normal,r[this.diagram as 'axial'|'shear'|'moment'][i]*scale);
          });this.line(points,0xc23872,member.sourceId);
        });
        diagramText=this.diagram==='deformation'?`Deformada x${scale.toFixed(1)}; max ${(maximum*1000).toFixed(3)} mm`:`${this.diagram}: |max| ${maximum.toFixed(3)} ${this.diagram==='moment'?'kN m':'kN'}; escala grafica automatica`;
      }
      this.analyticalStatus=`Plano ${model.plane} = ${model.ordinate} m | Idealizacion 2D del calculo${state.stale?' OBSOLETA':''} | ${diagramText|| (this.diagram!=='none'?'Sin resultados vigentes':'Cargas factorizadas; magnitudes en panel de calculo')}`;
    }else this.analyticalStatus='Sin plano de calculo. Configuracion pendiente.';
    const ledger=reinforcementLedger(docs);this.rebarError=ledger.errors.join(' / ');
    if(this.showSteel){
      // Render the explicitly specified bars, not inferred code-compliant reinforcement.
      ledger.paths.forEach(bar=>{
        const parts=bar.points.slice(1).map((b,i)=>{const a=bar.points[i],direction=b.clone().sub(a),g=new THREE.CylinderGeometry(bar.diameter/2000,bar.diameter/2000,direction.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);return g;});
        const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
        const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xb84738,roughness:.55,metalness:.3}));mesh.userData.sourceId=bar.sourceId;this.steel.add(mesh);
      });
    }
    this.registry.getAll().forEach(el=>{
      if(!el.mesh.userData.dualMaterial){el.mesh.material=Array.isArray(el.mesh.material)?el.mesh.material.map(m=>m.clone()):el.mesh.material.clone();el.mesh.userData.dualMaterial=true;}
      (Array.isArray(el.mesh.material)?el.mesh.material:[el.mesh.material]).forEach(m=>{m.transparent=this.transparent;m.opacity=this.transparent?.18:1;m.depthWrite=!this.transparent;});
      const lineMaterial=el.line.material as THREE.LineBasicMaterial;lineMaterial.transparent=this.transparent;lineMaterial.opacity=this.transparent?.2:1;
    });
    this.selection.highlightOpacity=this.showSteel?.05:.45;this.selection.refreshHighlight();
  }
  private render(view:BimView){
    const db=BimDatabase.getInstance(),vm=this.viewer.viewManager,active=vm.getActiveView();
    if(this.paired&&!vm.getOpenViews().some(v=>v.id==='dual-peer')){this.paired=false;this.get<HTMLInputElement>('model-sync').checked=false;}
    if(this.paired&&active.id!==this.pairPrimary&&active.id!=='dual-peer')this.compare(true);
    if(this.paired&&view!==active){
      if(view.type!==active.type||view.camera.type!==active.camera.type){view.type=active.type;view.camera=active.camera.clone();view.controls.object=view.camera;view.controls.enableRotate=active.type==='3d';}
      view.camera.position.copy(active.camera.position);view.camera.quaternion.copy(active.camera.quaternion);view.camera.up.copy(active.camera.up);view.controls.target.copy(active.controls.target);view.frustumSize=active.frustumSize;
      if(view.camera instanceof THREE.OrthographicCamera&&active.camera instanceof THREE.OrthographicCamera)view.camera.zoom=active.camera.zoom;
      const rect=view.domElement.getBoundingClientRect();view.updateProjection(rect.width,rect.height);view.camera.updateMatrixWorld();
    }
    if(this.dirty||db.revision!==this.revision||this.analysisVersion!==this.analysis.stateVersion){this.revision=db.revision;this.analysisVersion=this.analysis.stateVersion;this.dirty=false;this.rebuild();}
    const selected=this.selection.selectedElement?.uniqueId||'';if(selected!==this.selected){this.selected=selected;this.bars.forEach(b=>(b.material as THREE.LineBasicMaterial).color.setHex(b.userData.sourceId===selected?0x00a9eb:b.userData.baseColor));}
    this.registry.getAll().forEach(el=>el.mesh.visible=!this.isolateSelected||!selected||el.uniqueId===selected);
    this.steel.children.forEach(el=>el.visible=!this.isolateSelected||!selected||el.userData.sourceId===selected);
    view.titleSpan.textContent=`${view.modelMode==='analytical'?'Analitico':'Fisico'} | ${view.type==='3d'?'3D':view.type==='plan'?'Planta':'Frontal'}`;
    this.get('model-physical').classList.toggle('active',active.modelMode==='physical');this.get('model-analytical').classList.toggle('active',active.modelMode==='analytical');this.get<HTMLSelectElement>('model-projection').value=active.type;
    this.get('model-geometry-options').hidden=this.scope!=='axes'||active.modelMode!=='analytical'&&!this.paired;
    for(const id of ['model-supports','model-loads'])this.get<HTMLInputElement>(id).disabled=this.scope!=='calculation';
    this.info.dataset.joinState=this.physical.state;
    this.info.dataset.selectedId=this.selected;
    this.info.dataset.steelMeshes=String(this.steel.children.length);
    this.info.textContent=[this.physical.status,(active.modelMode==='analytical'||this.paired)?this.analyticalStatus:'',this.showSteel?'Armadura manual: E.060 no verificada; sin ganchos, anclajes ni traslapes.':'',this.rebarError].filter(Boolean).join(' | ');
    return view.modelMode==='analytical'?this.scene:this.viewer.scene;
  }
  private editRebar(){
    this.setMode('physical');
    const el=this.selection.selectedElement,doc=el?.uniqueId?BimDatabase.getInstance().getByGuid(el.uniqueId):undefined;
    const overlay=document.createElement('div');overlay.className='workspace-overlay';overlay.id='rebar-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Armadura manual');
    if(!doc||!['beam','column'].includes(doc.geometry.definition.type)){
      overlay.innerHTML='<section class="workspace-dialog rebar-dialog"><h2>Armadura manual</h2><p>Selecciona una viga o columna. Las mallas de losas y zapatas no estan implementadas.</p><button data-close>Cerrar</button></section>';overlay.querySelector<HTMLElement>('[data-close]')!.onclick=()=>overlay.remove();document.body.append(overlay);modalKeyboard(overlay,()=>overlay.remove());return;
    }
    const s=doc.reinforcement||{status:'manual-unverified',cover:.04,diameter:16,barsU:2,barsV:2,tieDiameter:8,tieSpacing:.2};
    const fields:[keyof RebarSpec,string,number,number,number][]=[['cover','Recubrimiento (m)',.01,.2,.005],['diameter','Diametro longitudinal (mm)',6,50,1],['barsU','Barras por cara U',2,20,1],['barsV','Barras por cara V',2,20,1],['tieDiameter','Diametro estribo (mm)',4,20,1],['tieSpacing','Separacion maxima estribos (m)',.04,2,.01]];
    overlay.innerHTML=`<section class="workspace-dialog rebar-dialog"><h2>Armadura manual</h2><p>E.060 no verificada. Longitudes rectas teoricas; sin ganchos, dobleces, anclajes ni traslapes.</p><form>${fields.map(([key,label,min,max,step])=>`<label>${label}<input name="${key}" type="number" required min="${min}" max="${max}" step="${step}" value="${s[key]}"/></label>`).join('')}<div class="workspace-actions"><button type="submit">Aplicar</button><button type="button" data-remove>Quitar</button><button type="button" data-close>Cancelar</button></div><p data-error role="alert"></p></form></section>`;
    document.body.append(overlay);modalKeyboard(overlay,()=>overlay.remove());overlay.querySelector<HTMLElement>('[data-close]')!.onclick=()=>overlay.remove();overlay.querySelector<HTMLElement>('[data-remove]')!.onclick=()=>{BimDatabase.getInstance().setReinforcement(doc.uniqueId,undefined);overlay.remove();};
    overlay.querySelector('form')!.onsubmit=e=>{
      e.preventDefault();try{
        const spec={status:'manual-unverified',...Object.fromEntries(fields.map(([key])=>[key,overlay.querySelector<HTMLInputElement>(`[name="${key}"]`)!.valueAsNumber]))} as RebarSpec;
        rebarPaths(doc.geometry.definition,spec);BimDatabase.getInstance().setReinforcement(doc.uniqueId,spec);this.showSteel=true;this.transparent=true;this.isolateSelected=true;this.get<HTMLInputElement>('model-steel').checked=true;this.get<HTMLInputElement>('model-transparent').checked=true;this.get<HTMLInputElement>('model-isolate').checked=true;this.dirty=true;this.fit();overlay.remove();
      }catch(error){overlay.querySelector<HTMLElement>('[data-error]')!.textContent=(error as Error).message;}
    };overlay.querySelector<HTMLInputElement>('input')!.focus();
  }
}
