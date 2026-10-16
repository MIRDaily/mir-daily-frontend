'use client'

import { useMemo, useState } from 'react'
import { nombreCarpeta, normalizar, SIN_CLASIFICAR, type AsignaturaCatalogo, type Carpeta } from '@/lib/carpetas/sugerir'

// Elegir la carpeta (asignatura y tema del catálogo) de un mapa o un grupo. Dos piezas:
//  - <ListaCarpetas>: buscador + sugeridas + «Sin clasificar» + asignaturas desplegables («General» y
//    sus temas). La usan el selector y el diálogo «Mover a…».
//  - <SelectorCarpeta>: una línea «Carpeta: … · Cambiar» que despliega la lista debajo (sin portales:
//    vive dentro de los diálogos de IA).
// La sugerencia se marca como tal hasta que el usuario elige otra cosa. Nada se archiva solo: lo que se
// ve aquí es lo que se guardará.

const INK = '#2C3E50'
const igual = (a: Carpeta, b: Carpeta | null | undefined) => !!b && a.subjectId === b.subjectId && a.topicId === b.topicId

export function ListaCarpetas({
  arbol,
  valor,
  candidatas = [],
  onElegir,
}: {
  arbol: AsignaturaCatalogo[]
  valor: Carpeta
  candidatas?: Carpeta[]
  onElegir: (c: Carpeta) => void
}) {
  const [busca, setBusca] = useState('')
  const [abierta, setAbierta] = useState<number | null>(valor.subjectId)
  const q = normalizar(busca)

  const filtradas = useMemo(() => {
    if (!q) return arbol
    return arbol
      .map((a) => {
        const asigCoincide = normalizar(a.nombre).includes(q) || normalizar(a.nombreCorto).includes(q) || normalizar(a.sigla ?? '') === q
        const temas = asigCoincide ? a.temas : a.temas.filter((t) => normalizar(t.nombre).includes(q))
        return asigCoincide || temas.length ? { ...a, temas } : null
      })
      .filter((a): a is AsignaturaCatalogo => a !== null)
  }, [arbol, q])

  const fila = (c: Carpeta, texto: string, extra?: string) => (
    <button
      key={`${c.subjectId}-${c.topicId}`}
      type="button"
      onClick={() => onElegir(c)}
      aria-pressed={igual(c, valor)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
        igual(c, valor) ? 'bg-[#FCEFEC] text-[#2C3E50]' : 'text-[#2C3E50] hover:bg-[#FAF7F4]'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{texto}</span>
      {extra && <span className="shrink-0 text-[0.65rem] font-bold text-[#7D8A96]">{extra}</span>}
      {igual(c, valor) && <span className="material-symbols-outlined shrink-0 text-[16px] text-[#E8A598]">check</span>}
    </button>
  )

  return (
    <div className="flex flex-col gap-2">
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Busca una asignatura o un tema…"
        aria-label="Buscar carpeta"
        className="w-full rounded-xl border border-[#7D8A96]/25 bg-white px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
      />
      <div className="max-h-64 overflow-y-auto pr-1">
        {!q && candidatas.length > 0 && (
          <div className="mb-2">
            <p className="px-2.5 pb-1 text-[0.65rem] font-extrabold tracking-wide text-[#7D8A96] uppercase">También podría ir en</p>
            {candidatas.map((c) => fila(c, nombreCarpeta(arbol, c)))}
          </div>
        )}
        {!q && fila(SIN_CLASIFICAR, 'Sin clasificar', 'la ordenas después')}
        {filtradas.map((a) => {
          const desplegada = !!q || abierta === a.id
          return (
            <div key={a.id} className="mt-1">
              <button
                type="button"
                onClick={() => setAbierta(desplegada && !q ? null : a.id)}
                aria-expanded={desplegada}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-extrabold text-[#2C3E50] hover:bg-[#FAF7F4]"
              >
                {a.sigla && (
                  <span className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-md text-[0.6rem] font-black text-white" style={{ background: INK }}>
                    {a.sigla}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                <span className="material-symbols-outlined shrink-0 text-[16px] text-[#7D8A96]">{desplegada ? 'expand_less' : 'expand_more'}</span>
              </button>
              {desplegada && (
                <div className="ml-4 border-l border-[#7D8A96]/20 pl-2">
                  {fila({ subjectId: a.id, topicId: null }, 'General', a.subtitulo ?? 'toda la asignatura')}
                  {a.temas.map((t) => fila({ subjectId: a.id, topicId: t.id }, t.nombre))}
                </div>
              )}
            </div>
          )
        })}
        {q && filtradas.length === 0 && <p className="px-2.5 py-2 text-xs text-[#7D8A96]">Nada con «{busca}».</p>}
      </div>
    </div>
  )
}

export default function SelectorCarpeta({
  arbol,
  valor,
  sugerida,
  candidatas,
  onChange,
  disabled = false,
}: {
  arbol: AsignaturaCatalogo[] | null
  valor: Carpeta
  /** La propuesta (se marca «sugerida» mientras sea la elegida). */
  sugerida?: Carpeta | null
  candidatas?: Carpeta[]
  onChange: (c: Carpeta) => void
  disabled?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  if (!arbol) return null
  const esSugerida = !!sugerida && sugerida.subjectId !== null && igual(valor, sugerida)
  return (
    <div className="rounded-xl border border-[#7D8A96]/20 bg-[#FAF7F4] px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">folder</span>
        <span className="font-bold text-[#7D8A96]">Carpeta:</span>
        <span className="min-w-0 flex-1 truncate font-extrabold text-[#2C3E50]" title={nombreCarpeta(arbol, valor)}>
          {nombreCarpeta(arbol, valor)}
        </span>
        {esSugerida && <span className="shrink-0 rounded-full bg-[#E8A598]/20 px-2 py-0.5 text-[0.65rem] font-extrabold text-[#C97D6F]">sugerida</span>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold text-[#C97D6F] hover:bg-white disabled:opacity-40"
        >
          {abierto ? 'Cerrar' : 'Cambiar'}
        </button>
      </div>
      {abierto && (
        <div className="mt-2">
          <ListaCarpetas
            arbol={arbol}
            valor={valor}
            candidatas={candidatas}
            onElegir={(c) => {
              onChange(c)
              setAbierto(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
