import { createElement, X, Check, Download, Upload, Save, Search, Trash2, Crosshair, ChevronLeft, ChevronRight, Plus, Minus, Undo2, Redo2, Pencil, RotateCcw, Calculator, FileText, PanelLeft, Move, Box, Network, Maximize, Settings2 } from 'lucide';
const iconSet = {X,Check,Download,Upload,Save,Search,Trash2,Crosshair,ChevronLeft,ChevronRight,Plus,Minus,Undo2,Redo2,Pencil,RotateCcw,Calculator,FileText,PanelLeft,Move,Box,Network,Maximize,Settings2};
export function icon(name: keyof typeof iconSet): string { const el=createElement(iconSet[name]);el.setAttribute('width','16');el.setAttribute('height','16');el.setAttribute('aria-hidden','true');return el.outerHTML; }
export function escapeHtml(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function download(content: string, name: string, mime='application/json'): void {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function modalKeyboard(container: HTMLElement, close:()=>void): void {
  container.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Escape') { e.preventDefault(); close(); }
    if(e.key==='Tab') {
      const items=Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea')).filter(x=>x.offsetParent!==null);
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  for(const event of ['pointerdown','pointermove','pointerup','click','dblclick']) container.addEventListener(event,e=>e.stopPropagation());
}
