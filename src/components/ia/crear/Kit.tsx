'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import './crearIA.css'

// Piezas compartidas de los diálogos «Crear con IA» (mapa, flashcards, resumen). Prototipo aprobado:
// LAB/ia-popups/index.html. Cada herramienta tiene su color y su textura (data-cia + crearIA.css):
//  - CabeceraCrear: icono, título, subtítulo y la ficha del documento con «Cambiar».
//  - TituloBloque: «1 ¿Cuánto detalle?», con una nota a la derecha.
//  - OpcionAnimada: una opción grande con su escena (Escenas.tsx). La elegida se reproduce en bucle; las
//    demás, al pasar el ratón. Una escena en marcha nunca se reinicia (ni por el clic ni por el bucle).
//  - LineaInterruptor: un extra en una línea (p. ej. «Añadir tablas comparativas»).
//  - Detalles / FilaDetalle: ajustes secundarios resumidos en una línea; se abren de uno en uno.
//  - PieCrear: el precio (PrecioIA) y el botón de generar juntos, y el aviso de privacidad.

export type HerramientaIA = 'mapa' | 'flashcards' | 'resumen'
export const INK = '#2C3E50'

const ICONO: Record<HerramientaIA, string> = { mapa: 'account_tree', flashcards: 'style', resumen: 'text_snippet' }

export function CabeceraCrear({
  herramienta,
  titulo,
  subtitulo,
  idTitulo,
  documento,
  onCambiarDocumento,
  onCerrar,
  cerrarDeshabilitado = false,
  icono,
}: {
  herramienta: HerramientaIA
  titulo: string
  subtitulo: string
  idTitulo?: string
  /** El documento ya leído: nombre y una línea de datos («12 páginas · 41.006 caracteres»). */
  documento?: { nombre: string; datos: string } | null
  onCambiarDocumento?: () => void
  onCerrar?: () => void
  cerrarDeshabilitado?: boolean
  /** Icono propio (si no, el de la herramienta). */
  icono?: string
}) {
  return (
    <header className="cia-tex px-5 pb-4 pt-4" style={{ borderBottom: `2px solid ${INK}` }}>
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: 'var(--cia-acc)', border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
          aria-hidden
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {icono ?? ICONO[herramienta]}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="text-[1.15rem] font-black tracking-tight text-[#2C3E50]">{titulo}</h2>
          <p className="text-[0.78rem] font-medium" style={{ color: 'var(--cia-ink)' }}>{subtitulo}</p>
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            disabled={cerrarDeshabilitado}
            aria-label="Cerrar"
            className="rounded-xl p-1.5 text-[#7D8A96] transition-colors hover:bg-white/70 hover:text-[#2C3E50] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        )}
      </div>
      {documento && (
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white py-2 pl-3 pr-2" style={{ border: `2px solid ${INK}` }}>
          <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--cia-acc-d)' }} aria-hidden>description</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.82rem] font-bold text-[#2C3E50]" title={documento.nombre}>{documento.nombre}</p>
            <p className="text-[0.72rem] text-[#7D8A96]">{documento.datos}</p>
          </div>
          {onCambiarDocumento && (
            <button
              type="button"
              onClick={onCambiarDocumento}
              className="rounded-lg px-2 py-1.5 text-[0.75rem] font-bold hover:bg-[var(--cia-soft)]"
              style={{ color: 'var(--cia-acc-d)' }}
            >
              Cambiar
            </button>
          )}
        </div>
      )}
    </header>
  )
}

export function TituloBloque({ n, children, nota }: { n?: number; children: ReactNode; nota?: ReactNode }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[0.82rem] font-black text-[#2C3E50]">
      {n !== undefined && (
        <span className="grid size-5 place-items-center rounded-full text-[0.68rem] text-white" style={{ background: INK }} aria-hidden>
          {n}
        </span>
      )}
      {children}
      {nota && <span className="ml-auto text-[0.72rem] font-medium text-[#7D8A96]">{nota}</span>}
    </h3>
  )
}

const DURACION_ESCENA = 4200

/** Reproduce la escena de un contenedor: la elegida en bucle, al pasar el ratón como vista previa. */
function useEscena(activa: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const desde = useRef(0)
  const [encima, setEncima] = useState(false)
  const reproducir = useCallback(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Una escena en marcha nunca se reinicia.
    if (Date.now() - desde.current < DURACION_ESCENA) return
    el.classList.remove('cia-play')
    void el.getBoundingClientRect()
    el.classList.add('cia-play')
    desde.current = Date.now()
  }, [])
  useEffect(() => {
    if (!activa && !encima) return
    reproducir()
    const t = setInterval(reproducir, 300)
    return () => clearInterval(t)
  }, [activa, encima, reproducir])
  return { ref, onPointerEnter: () => setEncima(true), onPointerLeave: () => setEncima(false) }
}

export function OpcionAnimada({
  activa,
  onElegir,
  titulo,
  descripcion,
  dato,
  escena,
  disabled = false,
  rol = 'radio',
}: {
  activa: boolean
  onElegir: () => void
  titulo: string
  descripcion: string
  /** Un dato corto bajo la descripción («≈101 nodos»). */
  dato?: string
  escena: ReactNode
  disabled?: boolean
  /** 'checkbox' cuando se pueden elegir varias (el popup de Studio). */
  rol?: 'radio' | 'checkbox'
}) {
  const { ref, onPointerEnter, onPointerLeave } = useEscena(activa)
  return (
    <button
      type="button"
      role={rol}
      aria-checked={activa}
      disabled={disabled}
      onClick={onElegir}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="relative rounded-[18px] bg-white p-2.5 pb-3 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      style={{ border: `2px solid ${activa ? INK : '#EDE6DE'}`, boxShadow: activa ? '4px 4px 0 0 var(--cia-acc)' : 'none' }}
    >
      <span
        className={`absolute right-2.5 top-2.5 grid size-5 place-items-center ${rol === 'checkbox' ? 'rounded-md' : 'rounded-full'}`}
        style={{ border: `2px solid ${activa ? INK : '#EDE6DE'}`, background: activa ? 'var(--cia-acc)' : '#fff' }}
        aria-hidden
      >
        {activa && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
      </span>
      <div ref={ref} className="cia-escena mb-2 grid h-[74px] place-items-center overflow-hidden rounded-xl" style={{ background: activa ? '#fff' : '#FAF7F4' }}>
        {escena}
      </div>
      <span className="block text-[0.85rem] font-black text-[#2C3E50]">{titulo}</span>
      <span className="mt-0.5 block text-[0.72rem] leading-snug text-[#7D8A96]">{descripcion}</span>
      {dato && (
        <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-bold" style={{ background: 'var(--cia-soft)', color: 'var(--cia-ink)' }}>
          {dato}
        </span>
      )}
    </button>
  )
}

/** Varias opciones en fila (2 o 3). */
export function Opciones({ children, columnas = 2, etiqueta }: { children: ReactNode; columnas?: 2 | 3; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={`grid gap-2.5 ${columnas === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {children}
    </div>
  )
}

export function LineaInterruptor({
  activo,
  onCambiar,
  etiqueta,
  info,
  disabled = false,
}: {
  activo: boolean
  onCambiar: (v: boolean) => void
  etiqueta: string
  /** Explicación al pasar el ratón por la «i». */
  info?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className="mt-2.5 flex w-full items-center gap-2.5 rounded-[14px] bg-white px-3 py-2 text-left transition-colors disabled:opacity-50"
      style={{ border: `2px solid ${activo ? INK : '#EDE6DE'}` }}
    >
      <span className="cia-toggle" data-on={activo} aria-hidden />
      <span className="text-[0.82rem] font-extrabold text-[#2C3E50]">{etiqueta}</span>
      {info && (
        <span className="material-symbols-outlined cursor-help text-[16px] text-[#7D8A96]" title={info} aria-label={info}>
          info
        </span>
      )}
    </button>
  )
}

/** Ajustes secundarios: cada uno en una línea con su valor; se abren de uno en uno. */
export function Detalles({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-white" style={{ border: `2px solid ${INK}` }}>
      {children}
    </div>
  )
}

export function FilaDetalle({
  icono,
  etiqueta,
  valor,
  abierta,
  onAlternar,
  children,
  primera = false,
}: {
  icono: string
  etiqueta: string
  valor: ReactNode
  abierta: boolean
  onAlternar: () => void
  children: ReactNode
  primera?: boolean
}) {
  return (
    <div style={primera ? undefined : { borderTop: '1px solid #EDE6DE' }}>
      <button type="button" onClick={onAlternar} aria-expanded={abierta} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#FAF7F4]">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[10px]" style={{ background: 'var(--cia-soft)', color: 'var(--cia-acc-d)' }} aria-hidden>
          <span className="material-symbols-outlined text-[18px]">{icono}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.66rem] font-bold uppercase tracking-wide text-[#7D8A96]">{etiqueta}</span>
          <span className="block truncate text-[0.82rem] font-bold text-[#2C3E50]">{valor}</span>
        </span>
        <span className="material-symbols-outlined text-[20px] text-[#7D8A96] transition-transform" style={{ transform: abierta ? 'rotate(180deg)' : 'none' }} aria-hidden>
          expand_more
        </span>
      </button>
      <div className="cia-panel" data-open={abierta}>
        <div>
          <div className="px-3.5 pb-3.5 pl-[3.4rem] text-[0.8rem]">{abierta ? children : null}</div>
        </div>
      </div>
    </div>
  )
}

/** El pie: precio y botón juntos, y el aviso de privacidad en una línea. */
export function PieCrear({
  precio,
  boton,
  onGenerar,
  puede,
  generando = false,
  falta,
}: {
  precio: ReactNode
  boton: string
  onGenerar: () => void
  puede: boolean
  generando?: boolean
  /** Por qué no se puede generar todavía (se enseña solo con el botón desactivado). */
  falta?: string
}) {
  return (
    <footer className="bg-white px-5 pb-3 pt-3.5" style={{ borderTop: `2px solid ${INK}` }}>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">{precio}</div>
        <button
          type="button"
          onClick={onGenerar}
          disabled={!puede || generando}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-[0.92rem] font-black text-white transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-50"
          style={{ background: 'var(--cia-boton)', border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>auto_awesome</span>
          {generando ? 'Generando…' : boton}
        </button>
      </div>
      {!puede && !generando && falta && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-[0.75rem] font-bold text-[#B04A5E]">
          <span className="material-symbols-outlined text-[16px]" aria-hidden>error</span>
          {falta}
        </p>
      )}
      <p className="mt-2 flex items-start gap-1.5 text-[0.68rem] leading-snug text-[#7D8A96]">
        <span className="material-symbols-outlined text-[14px]" aria-hidden>lock</span>
        Tu archivo no se guarda. El texto va a la IA (DeepSeek) solo para generar; revisa el resultado antes de estudiar con él.
      </p>
    </footer>
  )
}
