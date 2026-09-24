import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { Calculator, Upload, X } from 'lucide-react';
import { examples, type ExampleId } from '../../core/model/ExampleProjects';

export type ExamplesLoader = (id: ExampleId, analyze: boolean) => Promise<boolean>;

function Icon({ name }: { name: 'X' | 'Upload' | 'Calculator' }) {
  const Glyph = { X, Upload, Calculator }[name];
  return <Glyph size={16} aria-hidden="true" />;
}

export function ExamplesModalView({ load }: { load: ExamplesLoader | null }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExampleId>(examples[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const selectedInput = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    const show = () => {
      previousFocus.current = document.activeElement as HTMLElement | null;
      setError('');
      setOpen(true);
    };
    window.addEventListener('arm:examples:open', show);
    return () => window.removeEventListener('arm:examples:open', show);
  }, []);

  useEffect(() => {
    if (open) selectedInput.current?.focus();
    else previousFocus.current?.focus();
  }, [open]);

  function close() {
    if (!busy) setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      const items = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea',
        ),
      ).filter(item => item.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  async function submit(analyze: boolean) {
    if (busy) return;
    if (!load) {
      setError('El modelador todavía está iniciando.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (await load(selected, analyze)) setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el ejemplo.');
    } finally {
      setBusy(false);
    }
  }

  const stop = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <div
      id="examples-modal"
      className={`${open ? 'flex' : 'hidden'} fixed inset-0 z-[200] items-center justify-center bg-slate-950/70 p-2 md:p-5`}
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label="Modelos de ejemplo"
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onClick={stop}
      onDoubleClick={stop}
    >
      <section className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden border border-slate-300 bg-white text-slate-800 [&_button]:rounded [&_button]:border [&_button]:border-slate-300 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div>
            <span className="text-xs font-semibold">ARM / EJEMPLOS</span>
            <h2 className="text-lg font-semibold">Modelos de ejemplo</h2>
          </div>
          <button id="examples-close" className="flex h-8 w-8 items-center justify-center" title="Cerrar" aria-label="Cerrar" disabled={busy} onClick={close}>
            <Icon name="X" />
          </button>
        </header>
        <div className="min-h-0 overflow-auto">
          {examples.map(example => (
            <label className="flex cursor-pointer gap-3 border-b border-slate-200 p-4 has-[:checked]:bg-slate-100" key={example.id}>
              <input
                ref={selected === example.id ? selectedInput : undefined}
                type="radio"
                name="example"
                value={example.id}
                checked={selected === example.id}
                onChange={() => setSelected(example.id)}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <strong className="text-sm">{example.name}</strong>
                <b className="text-xs">{example.size}</b>
                <span className="text-xs">{example.scope}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          RNE E.020, E.030 y E.060: no verificados. Los casos de referencia comprueban resultados del calculo lineal, no el diseno integral de un edificio.
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2">
          <span id="examples-status" role="status" className="text-xs">{error}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button id="examples-load" disabled={busy} onClick={() => void submit(false)}>
              <Icon name="Upload" /> Cargar modelo
            </button>
            <button id="examples-analyze" className="primary" disabled={busy} onClick={() => void submit(true)}>
              <Icon name="Calculator" /> Cargar y analizar
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export class ExamplesModal {
  constructor(load: ExamplesLoader) {
    window.dispatchEvent(new CustomEvent<ExamplesLoader>('arm:examples:register', { detail: load }));
  }
  public open(): void {
    window.dispatchEvent(new Event('arm:examples:open'));
  }
}
