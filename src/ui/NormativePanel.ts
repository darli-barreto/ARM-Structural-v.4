import { defaultNormativeProfile, parseNormativeProfile, type NormativeProfile } from '../core/normative/Profile';
import { EDITIONS, REGISTRY_VERSION, REQUIREMENTS, STANDARD_IDS, TRANSITION_SOURCE } from '../core/normative/Registry';
import { normativeMatrix, normativeReport, STATUS_LABELS } from '../core/normative/Verification';
import { download, escapeHtml as h, icon, modalKeyboard } from './shared';
import './normative.css';

export class NormativePanel {
  private overlay=document.createElement('div');
  private previous:HTMLElement|null=null;
  private draft=defaultNormativeProfile();
  constructor(private getProfile:()=>NormativeProfile,private commit:(profile:NormativeProfile)=>void,
    private projectContext:()=>{projectId:string;modelRevision:number}) {
    this.overlay.id='normative-modal';this.overlay.className='workspace-overlay';this.overlay.hidden=true;
    this.overlay.setAttribute('role','dialog');this.overlay.setAttribute('aria-modal','true');this.overlay.setAttribute('aria-label','Perfil normativo');
    document.body.append(this.overlay);modalKeyboard(this.overlay,()=>this.close());
  }

  public open():void {
    this.previous=document.activeElement as HTMLElement;this.draft=structuredClone(this.getProfile());
    this.overlay.innerHTML=`<section class="workspace-dialog normative-dialog">
      <header class="workspace-heading"><div><span class="workspace-eyebrow">PERU / RNE</span><h2>Perfil normativo</h2></div><button id="normative-close" class="icon-button" title="Cerrar" aria-label="Cerrar">${icon('X')}</button></header>
      <div class="analysis-scope">Aplicabilidad pendiente de revision profesional. Sin comprobacion integral del RNE.</div>
      <div class="normative-body">
        <label class="normative-scope">Alcance del proyecto<textarea id="normative-scope" rows="2" maxlength="4000">${h(this.draft.scope)}</textarea></label>
        <div class="normative-standards">${STANDARD_IDS.map(standard=>{
          const selection=this.draft.selections[standard];
          return `<fieldset data-standard="${standard}"><legend>${standard}</legend><label>Edicion propuesta<select data-edition aria-label="Edicion ${standard}"><option value="">Sin definir</option>${EDITIONS.filter(e=>e.standard===standard).map(e=>`<option value="${e.id}" ${selection.editionId===e.id?'selected':''}>${h(e.title)}</option>`).join('')}</select></label>
            <label>Justificacion de aplicabilidad<textarea data-justification aria-label="Justificacion ${standard}" rows="2" maxlength="4000">${h(selection.justification)}</textarea></label>
            <label>Referencia de evidencia<input data-evidence aria-label="Evidencia ${standard}" maxlength="4000" value="${h(selection.evidenceReference)}" /></label>
            <div data-source></div></fieldset>`;
        }).join('')}</div>
        <p class="normative-transition"><a href="${TRANSITION_SOURCE.url}" target="_blank" rel="noopener noreferrer">${h(TRANSITION_SOURCE.reference)}</a></p>
        <h3>Verificaciones pendientes</h3><div id="normative-matrix" aria-live="polite"></div>
        <p class="normative-version">Registro ${REGISTRY_VERSION} / Revision del perfil <span id="normative-revision">${this.draft.revision}</span></p>
      </div>
      <footer class="workspace-footer"><span id="normative-status" role="status"></span><div class="workspace-actions"><button id="normative-export" title="Exportar matriz guardada">${icon('Download')} Matriz</button><button id="normative-cancel">Cancelar</button><button id="normative-save" class="primary">${icon('Save')} Guardar perfil</button></div></footer>
    </section>`;
    this.overlay.hidden=false;
    this.overlay.querySelector('#normative-close')!.addEventListener('click',()=>this.close());
    this.overlay.querySelector('#normative-cancel')!.addEventListener('click',()=>this.close());
    this.overlay.querySelector('#normative-save')!.addEventListener('click',()=>{
      try{
        this.commit(parseNormativeProfile(this.readDraft()));this.draft=structuredClone(this.getProfile());
        this.overlay.querySelector('#normative-revision')!.textContent=String(this.draft.revision);
        this.overlay.querySelector('#normative-status')!.textContent='Perfil guardado. Verificacion pendiente.';
        this.refresh();
      }catch(error){this.overlay.querySelector('#normative-status')!.textContent=(error as Error).message;}
    });
    this.overlay.querySelector('#normative-export')!.addEventListener('click',()=>{
      const context=this.projectContext();
      download(JSON.stringify(normativeReport(this.getProfile(),context.projectId,context.modelRevision),null,2),'matriz-rne.json');
    });
    this.overlay.querySelectorAll('input,select,textarea').forEach(input=>input.addEventListener('input',()=>{
      this.overlay.querySelector('#normative-status')!.textContent='Cambios sin guardar';this.refresh();
    }));
    this.refresh();this.overlay.querySelector<HTMLTextAreaElement>('#normative-scope')!.focus();
  }

  private readDraft():NormativeProfile {
    const profile=structuredClone(this.draft);
    profile.scope=this.overlay.querySelector<HTMLTextAreaElement>('#normative-scope')!.value;
    for(const standard of STANDARD_IDS){
      const row=this.overlay.querySelector(`[data-standard="${standard}"]`)!;
      profile.selections[standard]={editionId:row.querySelector<HTMLSelectElement>('[data-edition]')!.value||null,
        justification:row.querySelector<HTMLTextAreaElement>('[data-justification]')!.value,
        evidenceReference:row.querySelector<HTMLInputElement>('[data-evidence]')!.value};
    }
    return profile;
  }

  private refresh():void {
    const profile=this.readDraft();
    for(const standard of STANDARD_IDS){
      const edition=EDITIONS.find(e=>e.id===profile.selections[standard].editionId);
      this.overlay.querySelector(`[data-standard="${standard}"] [data-source]`)!.innerHTML=edition
        ?`<a href="${h(edition.url)}" target="_blank" rel="noopener noreferrer">${h(edition.reference)}</a><p>${h(edition.limitation)}</p>`
        :'<p>Sin edicion seleccionada.</p>';
    }
    this.overlay.querySelector('#normative-matrix')!.innerHTML=normativeMatrix(profile).map(check=>{
      const rule=REQUIREMENTS.find(r=>r.id===check.requirementId)!;
      return `<div class="normative-check" data-check="${rule.id}"><div><strong>${h(rule.title)}</strong><small>${h(rule.standard)} / ${h(rule.article)}</small></div><b class="normative-state">${STATUS_LABELS[check.status]}</b><p>${h(check.reason)}</p></div>`;
    }).join('');
    const dirty=JSON.stringify(profile)!==JSON.stringify(this.draft);
    this.overlay.querySelector<HTMLButtonElement>('#normative-export')!.disabled=dirty;
  }

  private close():void{this.overlay.hidden=true;this.previous?.focus();}
}
