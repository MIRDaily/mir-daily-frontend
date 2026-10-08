import type { FlashcardSource } from '@/lib/studioFlashcards'

// «Ver de dónde sale» al estudiar una tarjeta de la IA: el archivo y la página, el trozo del texto
// (corto a propósito) y, si salió de un mapa, un enlace a su rama (en otra pestaña: la sesión sigue).

/** «Tema 03 Vasculitis.pdf · pág. 12» (o «· diapositiva 4»). */
export function lugarDeFuente(s: FlashcardSource): string {
  const donde = s.page ? `${s.unit === 'diapositiva' ? 'diapositiva' : 'pág.'} ${s.page}` : ''
  return [s.name, donde].filter(Boolean).join(' · ')
}

export function FuenteTarjeta({ source, abierta, onAlternar }: { source: FlashcardSource; abierta: boolean; onAlternar: () => void }) {
  const lugar = lugarDeFuente(source)
  const rama = source.mapId ? `/mapas/${source.mapId}${source.nodeId ? `?nodo=${encodeURIComponent(source.nodeId)}` : ''}` : null
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#D4C8BE] bg-white/70 px-4 py-3">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="flex w-full items-center gap-2 text-left text-sm font-extrabold text-[#2C3E50]"
      >
        <span aria-hidden className="inline-block text-[#C99A8D]">
          <span className="material-symbols-outlined text-[1.2rem] leading-none">menu_book</span>
        </span>
        <span className="flex-1">Ver de dónde sale</span>
        <kbd className="rounded border border-[#D9D0CB] bg-[#FBF8F6] px-1 text-[0.65rem] font-bold text-[#8A7F79]">F</kbd>
        <span aria-hidden className="inline-block text-[#7D8A96]">
          <span className="material-symbols-outlined text-[1.2rem] leading-none">{abierta ? 'expand_less' : 'expand_more'}</span>
        </span>
      </button>
      {abierta ? (
        <div className="mt-2 space-y-2">
          {lugar ? <p className="text-xs font-bold text-[#7D8A96]">{lugar}</p> : null}
          {source.snippet ? (
            <blockquote className="border-l-4 border-[#E8A598] pl-3 text-sm leading-relaxed text-[#2C3E50]">{source.snippet}</blockquote>
          ) : (
            <p className="text-xs text-[#7D8A96]">No se guardó el trozo del texto de esta tarjeta.</p>
          )}
          {rama ? (
            <a
              href={rama}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#2c3e50] bg-white px-3 py-1.5 text-xs font-extrabold text-[#2C3E50] hover:bg-[#FAF7F4]"
            >
              <span aria-hidden className="inline-block">
                <span className="material-symbols-outlined text-[1rem] leading-none">account_tree</span>
              </span>
              Abrir la rama en el mapa
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
