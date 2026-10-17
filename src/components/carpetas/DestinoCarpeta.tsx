'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { subjectVisual } from '@/lib/subjectVisuals'
import { normalizar, SIN_CLASIFICAR, type AsignaturaCatalogo, type Carpeta } from '@/lib/carpetas/sugerir'

// «Dónde se guarda»: la carpeta como una carpeta de verdad (color y sigla de la asignatura), con la
// asignatura y el tema en dos líneas y el porqué debajo. «Cambiar» abre una hoja en dos pasos: las
// sugeridas y la cuadrícula de asignaturas → sus temas («Toda la asignatura» primero), un buscador de
// temas y «Sin clasificar» al final. Prototipo aprobado: LAB/ia-popups/index.html.

const INK = '#2C3E50'
const igual = (a: Carpeta, b: Carpeta | null | undefined) => !!b && a.subjectId === b.subjectId && a.topicId === b.topicId

function colorDe(a: AsignaturaCatalogo | null): string {
  return a ? subjectVisual(a.nombre).color.bg : '#C9D1D8'
}

export function IconoCarpeta({ asignatura, ancho = 58, alto = 48 }: { asignatura: AsignaturaCatalogo | null; ancho?: number; alto?: number }) {
  const bg = colorDe(asignatura)
  return (
    <svg viewBox="0 0 64 52" width={ancho} height={alto} aria-hidden="true">
      <path d="M5 10a6 6 0 0 1 6-6h13l6 6h23a6 6 0 0 1 6 6v4H5z" fill={bg} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" opacity=".75" />
      <path d="M5 18a4 4 0 0 1 4-4h46a4 4 0 0 1 4 4v24a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" fill={bg} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <text x="32" y="38" textAnchor="middle" fontWeight="900" fontSize="14" fill="#fff">{asignatura?.sigla ?? '?'}</text>
    </svg>
  )
}

export default function DestinoCarpeta({
  arbol,
  valor,
  sugerida,
  candidatas = [],
  onChange,
  disabled = false,
  nota,
}: {
  arbol: AsignaturaCatalogo[]
  valor: Carpeta
  /** La propuesta: mientras sea la elegida se explica por qué. */
  sugerida?: Carpeta | null
  candidatas?: Carpeta[]
  onChange: (c: Carpeta) => void
  disabled?: boolean
  /** Una línea extra bajo el bloque (p. ej. «cada tema irá a su carpeta…»). */
  nota?: string
}) {
  const [abierta, setAbierta] = useState(false)
  const [cambio, setCambio] = useState(0)
  const a = valor.subjectId === null ? null : (arbol.find((x) => x.id === valor.subjectId) ?? null)
  const tema = a && valor.topicId !== null ? a.temas.find((t) => t.id === valor.topicId) : null
  const esSugerida = !!sugerida && sugerida.subjectId !== null && igual(valor, sugerida)

  return (
    <div>
      <div
        key={cambio}
        className="flex items-center gap-3.5 rounded-[18px] bg-white px-3.5 py-3"
        style={{ border: `2px solid ${INK}`, animation: cambio ? 'cia-pop .45s cubic-bezier(.3,1.6,.5,1)' : undefined }}
      >
        <IconoCarpeta asignatura={a} />
        <div className="min-w-0 flex-1">
          {a ? (
            <>
              <span className="block text-[0.92rem] font-black leading-tight text-[#2C3E50]">{a.nombre}</span>
              <span className="block truncate text-[0.8rem] font-semibold text-[#2C3E50]">{tema ? tema.nombre : 'Toda la asignatura'}</span>
            </>
          ) : (
            <>
              <span className="block text-[0.92rem] font-black leading-tight text-[#2C3E50]">Sin clasificar</span>
              <span className="block text-[0.8rem] font-semibold text-[#2C3E50]">Lo ordenas cuando quieras</span>
            </>
          )}
          <span className="mt-1 flex items-center gap-1 text-[0.7rem] text-[#7D8A96]">
            {esSugerida ? (
              <>
                <span className="material-symbols-outlined text-[14px] text-[#B07A1E]" aria-hidden>auto_awesome</span>
                Sugerida por lo que trata el documento
              </>
            ) : a ? (
              <>
                <span className="material-symbols-outlined text-[14px]" aria-hidden>menu_book</span>
                Lo verás en Biblioteca › {a.nombreCorto}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[14px]" aria-hidden>info</span>
                No contará en ningún tema hasta que lo muevas
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAbierta(true)}
          className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-[0.75rem] font-extrabold text-[#2C3E50] hover:bg-[#FAF7F4] disabled:opacity-40"
          style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
        >
          Cambiar
        </button>
      </div>
      {nota && <p className="mt-1.5 text-[0.7rem] text-[#7D8A96]">{nota}</p>}
      {abierta && (
        <HojaCarpetas
          arbol={arbol}
          valor={valor}
          sugeridas={[...(sugerida && sugerida.subjectId !== null ? [sugerida] : []), ...candidatas].slice(0, 3)}
          onCerrar={() => setAbierta(false)}
          onElegir={(c) => {
            setAbierta(false)
            if (!igual(c, valor)) {
              onChange(c)
              setCambio((n) => n + 1)
            }
          }}
        />
      )}
    </div>
  )
}

function HojaCarpetas({
  arbol,
  valor,
  sugeridas,
  onCerrar,
  onElegir,
}: {
  arbol: AsignaturaCatalogo[]
  valor: Carpeta
  sugeridas: Carpeta[]
  onCerrar: () => void
  onElegir: (c: Carpeta) => void
}) {
  const [asignatura, setAsignatura] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [dentro, setDentro] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDentro(true))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [onCerrar])

  const q = normalizar(busca)
  const resultados = useMemo(() => {
    if (q.length < 2) return []
    return arbol
      .flatMap((a) => a.temas.filter((t) => normalizar(t.nombre).includes(q)).map((t): Carpeta => ({ subjectId: a.id, topicId: t.id })))
      .concat(arbol.filter((a) => normalizar(a.nombre).includes(q) || normalizar(a.nombreCorto).includes(q)).map((a): Carpeta => ({ subjectId: a.id, topicId: null })))
      .slice(0, 12)
  }, [arbol, q])

  const opcion = (c: Carpeta, extra = '') => {
    const a = c.subjectId === null ? null : (arbol.find((x) => x.id === c.subjectId) ?? null)
    const t = a && c.topicId !== null ? a.temas.find((x) => x.id === c.topicId) : null
    const actual = igual(c, valor)
    return (
      <button
        key={`${c.subjectId}-${c.topicId}`}
        type="button"
        onClick={() => onElegir(c)}
        aria-current={actual}
        className={`flex w-full items-center gap-2.5 rounded-[14px] bg-white px-2.5 py-2 text-left hover:border-[#2C3E50] ${c.subjectId === null ? 'border-dashed' : ''}`}
        style={{ border: `2px ${c.subjectId === null ? 'dashed' : 'solid'} ${actual ? INK : '#EDE6DE'}`, boxShadow: actual ? `2px 2px 0 0 ${INK}` : 'none' }}
      >
        <IconoCarpeta asignatura={a} ancho={30} alto={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-extrabold text-[#2C3E50]">{a ? (t ? t.nombre : 'Toda la asignatura') : 'Sin clasificar'}</span>
          <span className="block truncate text-[0.7rem] text-[#7D8A96]">{a ? `${a.nombre}${extra}` : 'Lo decides después, desde Biblioteca'}</span>
        </span>
        {actual && <span className="material-symbols-outlined text-[20px] text-[#C97D6F]" aria-hidden>check_circle</span>}
      </button>
    )
  }

  const elegida = asignatura === null ? null : (arbol.find((a) => a.id === asignatura) ?? null)

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <div className="fixed inset-0 z-[130] bg-[#2C3E50]/35 transition-opacity duration-200" style={{ opacity: dentro ? 1 : 0 }} onMouseDown={onCerrar} />
      {/* En móvil, una hoja que sube desde abajo; desde 640 px, un diálogo centrado y completo (abajo,
          sin su borde inferior, parecía cortado). La animación va por variables: el transform cambia según
          el ancho y el estilo en línea no admite media queries. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir dónde se guarda"
        className="fixed bottom-0 left-1/2 z-[131] flex max-h-[82dvh] w-[min(560px,calc(100%-24px))] flex-col rounded-t-[26px] border-2 border-b-0 border-[#2C3E50] bg-[#FAF7F4] [transform:translate(-50%,var(--hoja-y))] transition-[transform,opacity] duration-300 sm:top-1/2 sm:bottom-auto sm:max-h-[min(86dvh,760px)] sm:rounded-[26px] sm:border-b-2 sm:opacity-[var(--hoja-op)] sm:shadow-[7px_7px_0_0_#2C3E50] sm:[transform:translate(-50%,-50%)_scale(var(--hoja-esc))]"
        style={
          {
            '--hoja-y': dentro ? '0%' : '105%',
            '--hoja-esc': dentro ? 1 : 0.96,
            '--hoja-op': dentro ? 1 : 0,
            transitionTimingFunction: 'cubic-bezier(.2,.9,.3,1)',
          } as CSSProperties
        }
      >
        <div className="flex items-center gap-2 px-[18px] pb-2.5 pt-3.5">
          {elegida ? (
            <>
              <button type="button" onClick={() => setAsignatura(null)} aria-label="Volver a las asignaturas" className="rounded-lg p-1 text-[#2C3E50] hover:bg-white">
                <span className="material-symbols-outlined text-[22px]">arrow_back</span>
              </button>
              <IconoCarpeta asignatura={elegida} ancho={30} alto={26} />
              <h3 className="text-base font-black text-[#2C3E50]">{elegida.nombre}</h3>
            </>
          ) : (
            <h3 className="text-base font-black text-[#2C3E50]">¿Dónde lo guardamos?</h3>
          )}
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto rounded-lg p-1 text-[#7D8A96] hover:bg-white hover:text-[#2C3E50]">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto px-[18px] pb-[18px]">
          {elegida ? (
            <div className="flex flex-col gap-1.5">
              {opcion({ subjectId: elegida.id, topicId: null }, elegida.subtitulo ? ` · ${elegida.subtitulo}` : ' · si trata varios temas')}
              {elegida.temas.length ? (
                elegida.temas.map((t) => opcion({ subjectId: elegida.id, topicId: t.id }))
              ) : (
                <p className="px-0.5 py-1 text-[0.78rem] text-[#7D8A96]">Esta asignatura aún no tiene temas: se guardará en «Toda la asignatura».</p>
              )}
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busca un tema: «lupus», «asma»…"
                aria-label="Buscar un tema"
                className="mb-3 w-full rounded-xl border-2 border-[#EDE6DE] bg-white px-3 py-2 text-[0.82rem] font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
              />
              {q.length >= 2 ? (
                resultados.length ? (
                  <div className="flex flex-col gap-1.5">{resultados.map((c) => opcion(c))}</div>
                ) : (
                  <p className="px-0.5 py-1 text-[0.78rem] text-[#7D8A96]">Nada con «{busca}».</p>
                )
              ) : (
                <>
                  {sugeridas.length > 0 && (
                    <>
                      <p className="mb-1.5 text-[0.66rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">Sugeridas</p>
                      <div className="mb-3.5 flex flex-col gap-1.5">{sugeridas.map((c, i) => opcion(c, i === 0 ? ' · la más probable' : ''))}</div>
                    </>
                  )}
                  <p className="mb-1.5 text-[0.66rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">{sugeridas.length ? 'O elige asignatura' : 'Elige asignatura'}</p>
                  <div className="mb-3.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {arbol.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setAsignatura(x.id)}
                        aria-current={x.id === valor.subjectId}
                        className="flex flex-col items-center gap-1 rounded-[14px] bg-white px-1 pb-2 pt-2.5 transition-transform hover:-translate-y-0.5"
                        style={{ border: `2px solid ${x.id === valor.subjectId ? INK : '#EDE6DE'}`, boxShadow: x.id === valor.subjectId ? `2px 2px 0 0 ${INK}` : 'none' }}
                      >
                        <span className="grid size-[34px] place-items-center rounded-[10px] text-[0.75rem] font-black text-white" style={{ background: colorDe(x), border: `2px solid ${INK}` }}>
                          {x.sigla ?? '·'}
                        </span>
                        <span className="text-center text-[0.68rem] font-bold leading-tight text-[#2C3E50]">{x.nombreCorto}</span>
                        <span className="text-[0.62rem] text-[#7D8A96]">{x.temas.length ? `${x.temas.length} temas` : 'sin temas'}</span>
                      </button>
                    ))}
                  </div>
                  {opcion(SIN_CLASIFICAR)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
