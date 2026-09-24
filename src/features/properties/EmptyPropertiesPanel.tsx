export default function EmptyPropertiesPanel() {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-1.5 p-4 text-center text-slate-400">
      <div aria-hidden="true" className="mb-1 text-3xl opacity-40">📐</div>
      <p className="font-medium text-slate-300">Ningún elemento seleccionado</p>
      <span className="text-[11px] leading-relaxed text-slate-500">
        Selecciona un elemento estructural, rejilla o nivel para ver y editar sus parámetros BIM en tiempo real.
      </span>
    </div>
  );
}
