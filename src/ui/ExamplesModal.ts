import { ExampleId, examples } from '../core/model/ExampleProjects';
import { escapeHtml as h, icon, modalKeyboard } from './shared';
import './workspace.css';

export class ExamplesModal {
  private overlay=document.createElement('div');private previous:HTMLElement|null=null;private busy=false;
  constructor(private load:(id:ExampleId,analyze:boolean)=>Promise<boolean>) {
    this.overlay.id='examples-modal';this.overlay.className='workspace-overlay';this.overlay.hidden=true;
    this.overlay.setAttribute('role','dialog');this.overlay.setAttribute('aria-modal','true');this.overlay.setAttribute('aria-label','Modelos de ejemplo');
    this.overlay.innerHTML=`<section class="workspace-dialog examples-dialog"><header class="workspace-heading"><div><span class="workspace-eyebrow">ARM / EJEMPLOS</span><h2>Modelos de ejemplo</h2></div><button id="examples-close" class="icon-button" title="Cerrar" aria-label="Cerrar">${icon('X')}</button></header><div class="examples-list">${examples.map((e,i)=>`<label class="example-option"><input type="radio" name="example" value="${e.id}" ${i===0?'checked':''}/><span><strong>${h(e.name)}</strong><b>${h(e.size)}</b><span>${h(e.scope)}</span></span></label>`).join('')}</div><div class="analysis-scope">RNE E.020, E.030 y E.060: no verificados. Los casos de referencia comprueban resultados del calculo lineal, no el diseno integral de un edificio.</div><footer class="workspace-footer"><span id="examples-status" role="status"></span><div class="workspace-actions"><button id="examples-load">${icon('Upload')} Cargar modelo</button><button id="examples-analyze" class="primary">${icon('Calculator')} Cargar y analizar</button></div></footer></section>`;
    document.body.append(this.overlay);modalKeyboard(this.overlay,()=>this.close());
    this.overlay.querySelector<HTMLButtonElement>('#examples-close')!.onclick=()=>this.close();
    for(const [id,analyze] of [['examples-load',false],['examples-analyze',true]] as const)this.overlay.querySelector<HTMLButtonElement>('#'+id)!.onclick=async()=>{
      if(this.busy)return;this.busy=true;this.buttons(true);
      try{const selected=this.overlay.querySelector<HTMLInputElement>('input:checked')!.value as ExampleId;
        if(await this.load(selected,analyze)){this.busy=false;this.close();}
      }catch(e){this.overlay.querySelector('#examples-status')!.textContent=(e as Error).message;}
      finally{this.busy=false;this.buttons(false);}
    };
  }
  private buttons(disabled:boolean):void{this.overlay.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=disabled);}
  public open():void{this.previous=document.activeElement as HTMLElement;this.overlay.hidden=false;this.overlay.querySelector('#examples-status')!.textContent='';this.overlay.querySelector<HTMLInputElement>('input:checked')!.focus();}
  private close():void{if(this.busy)return;this.overlay.hidden=true;this.previous?.focus();}
}
