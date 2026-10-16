'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { arbolProvisional, type FaseIA, type LineaProvisional, type RamaProvisional } from '@/lib/mapas/ia/stream'
import type { HerramientaIA } from '@/components/ia/crear/Kit'
import '@/components/ia/crear/crearIA.css'

// Pantalla de generación de «Crear con IA» (mapas, flashcards, resúmenes, ramas, añadir documento). La usan
// seis diálogos con la misma interfaz de siempre. Rediseño aprobado en LAB/ia-popups/index.html:
//  - una escena animada por herramienta con lo que de verdad va llegando por el streaming: el árbol
//    provisional (mapa), las preguntas (flashcards) o el último párrafo (resumen), con su contador;
//  - los pasos (las fases), una barra de progreso que nunca se queda quieta y el tiempo que falta;
//  - la mascota con consejos que rotan.
// Es solo una vista: texto plano (React lo escapa), sin guardar nada; al terminar, lo validado la sustituye.
// Sin botón de cancelar: si se cierra la pestaña, el servidor corta la generación (no sigue de fondo).

export const INK = '#2C3E50'
export const STICKER_SHADOW = `4px 4px 0 0 ${INK}`

const NOMBRE: Record<FaseIA, string> = {
  leyendo: 'Leyendo',
  estructura: 'Estructura',
  tablas: 'Tablas',
  tarjetas: 'Tarjetas',
  parrafos: 'Párrafos',
  ordenando: 'Ordenando',
}
const ICONO_FASE: Record<FaseIA, string> = {
  leyendo: 'menu_book',
  estructura: 'account_tree',
  tablas: 'table_chart',
  tarjetas: 'style',
  parrafos: 'notes',
  ordenando: 'auto_fix_high',
}
const MIENTRAS: Record<FaseIA, string> = {
  leyendo: 'Leyendo el documento…',
  estructura: 'Construyendo la estructura…',
  tablas: 'Preparando las tablas…',
  tarjetas: 'Escribiendo las tarjetas…',
  parrafos: 'Escribiendo los párrafos…',
  ordenando: 'Revisando y ordenando…',
}
const CONSEJOS: Record<HerramientaIA, string[]> = {
  mapa: [
    'En el editor, la tecla Espacio pliega y despliega ramas.',
    'Cada nodo lleva la página de donde sale: la revisión guiada te lleva a lo dudoso.',
    'Puedes sacar flashcards de cualquier rama del mapa con un clic.',
  ],
  flashcards: [
    'Las tarjetas salen de fácil a demencial: empieza por las fáciles y el resto se abre solo.',
    'Antes de guardar puedes editar o descartar cualquier tarjeta.',
    '«Más de este tema» genera tarjetas nuevas de un tema concreto.',
  ],
  resumen: [
    'Los huecos se eligen por dificultad: los fáciles son los datos que más caen.',
    'Al estudiar puedes escribir la respuesta o solo destaparla.',
    'Si un párrafo no te convence, «Rehacer» lo vuelve a escribir.',
  ],
}
const ESTADO_TEMA = { espera: 'en espera', empieza: 'generando', listo: 'listo', fallo: 'no salió' } as const

export function ProgresoIA({
  fases,
  fase,
  lineas,
  segundos,
  detalle,
  arbol: arbolDado,
  temas,
  contador,
  vacio = 'La IA está leyendo el documento…',
  herramienta: herramientaDada,
  estimado,
}: {
  /** Las fases que tiene esta generación (sin «Incluir tablas», no hay fase de tablas). */
  fases: FaseIA[]
  fase: FaseIA
  lineas: LineaProvisional[]
  segundos: number
  /** Texto extra bajo las fases (p. ej. «Tema 3 de 16»). */
  detalle?: string
  /** Árbol ya montado (documento largo: un bloque por tema); si no, sale de `lineas`. */
  arbol?: RamaProvisional[]
  /** Documento largo: cómo va cada tema. */
  temas?: { titulo: string; estado: 'espera' | 'empieza' | 'listo' | 'fallo' }[]
  /** Texto del contador (flashcards: «N preguntas…»); por defecto, las ramas. */
  contador?: (lineas: LineaProvisional[]) => string
  /** Lo que se lee mientras aún no ha llegado nada. */
  vacio?: string
  /** Qué se genera (si no, se deduce de las fases). */
  herramienta?: HerramientaIA
  /** Segundos que suele tardar (el máximo de la estimación): da la barra y el «quedan». */
  estimado?: number
}) {
  const herramienta: HerramientaIA = herramientaDada ?? (fases.includes('tarjetas') ? 'flashcards' : fases.includes('parrafos') ? 'resumen' : 'mapa')
  const propio = useMemo(() => arbolProvisional(lineas), [lineas])
  const arbol = arbolDado ?? propio
  const actual = Math.max(0, fases.indexOf(fase))

  // Progreso: lo que marca la fase y lo que marca el tiempo, lo que vaya más adelante. Pasado lo
  // estimado se acerca al final sin llegar nunca (no se queda quieto ni miente con un 100 %).
  const porFase = fases.length > 1 ? actual / fases.length : 0
  const porTiempo = estimado ? (segundos <= estimado ? (segundos / estimado) * 0.9 : 0.9 + (1 - Math.exp(-(segundos - estimado) / 20)) * 0.08) : 0
  const progreso = Math.min(0.98, Math.max(porFase, porTiempo, 0.03))
  const quedan = estimado ? Math.ceil(estimado - segundos) : null

  const ramas = useMemo(() => lineas.filter((l) => l.d >= (herramienta === 'mapa' ? 0 : 2)).length, [lineas, herramienta])
  const textoContador = lineas.length
    ? contador
      ? contador(lineas)
      : herramienta === 'flashcards'
        ? `${ramas} ${ramas === 1 ? 'tarjeta' : 'tarjetas'}`
        : herramienta === 'resumen'
          ? `${ramas} ${ramas === 1 ? 'párrafo' : 'párrafos'}`
          : `${lineas.length} ${lineas.length === 1 ? 'rama' : 'ramas'}`
    : null

  return (
    <div data-cia={herramienta} role="status" aria-live="polite" className="mt-1">
      <div className="relative h-[230px] overflow-hidden rounded-[20px] bg-white" style={{ border: `2px solid ${INK}` }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(125,138,150,.18) 1px, transparent 1.2px)', backgroundSize: '16px 16px' }}
          aria-hidden
        />
        {lineas.length === 0 && arbol.length === 0 ? (
          <EscenaLeyendo texto={vacio} />
        ) : herramienta === 'flashcards' ? (
          <EscenaTarjetas lineas={lineas} />
        ) : herramienta === 'resumen' ? (
          <EscenaParrafo lineas={lineas} />
        ) : (
          <EscenaArbol arbol={arbol} />
        )}
        {textoContador && (
          <span key={textoContador} className="cia-cuenta absolute bottom-2.5 left-3 rounded-full px-2.5 py-1 text-[0.72rem] font-bold text-white" style={{ background: INK }}>
            {textoContador}
          </span>
        )}
      </div>

      <ol className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${fases.length}, minmax(0, 1fr))` }} aria-label="Fases">
        {fases.map((f, i) => {
          const hecha = i < actual
          const activa = i === actual
          return (
            <li key={f} className="relative flex flex-col items-center gap-1.5 text-center text-[0.7rem] font-bold" style={{ color: activa ? INK : '#7D8A96' }} aria-current={activa ? 'step' : undefined}>
              {i > 0 && <span className="absolute left-[-50%] top-[13px] h-[3px] w-full" style={{ background: hecha || activa ? INK : '#EDE6DE' }} aria-hidden />}
              <span
                className={`relative z-[1] grid size-7 place-items-center rounded-full transition-colors ${activa ? 'cia-paso-activo' : ''}`}
                style={{ border: `2px solid ${hecha || activa ? INK : '#EDE6DE'}`, background: hecha ? INK : activa ? 'var(--cia-acc)' : '#fff', color: hecha || activa ? '#fff' : '#7D8A96' }}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden>{hecha ? 'check' : ICONO_FASE[f]}</span>
              </span>
              {NOMBRE[f]}
            </li>
          )
        })}
      </ol>

      <div className="mt-3.5">
        <div className="h-3 overflow-hidden rounded-full bg-white" style={{ border: `2px solid ${INK}` }}>
          <div className="cia-rayas h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(progreso * 100)}%` }} />
        </div>
        <p className="mt-1.5 flex justify-between gap-2 text-[0.72rem] font-semibold text-[#7D8A96]">
          <span>{MIENTRAS[fase]}</span>
          <span className="tabular-nums">
            {quedan !== null && quedan > 0 ? <>Quedan <b className="text-[#2C3E50]">~{quedan} s</b></> : quedan !== null ? 'Un poco más…' : `${segundos} s`}
          </span>
        </p>
        {detalle && <p className="mt-1 text-[0.72rem] font-bold text-[#2C3E50]">{detalle}</p>}
      </div>

      {temas && temas.length > 0 && (
        <ol className="mt-2 flex flex-wrap gap-1" aria-label="Temas">
          {temas.map((t, i) => (
            <li
              key={i}
              title={`${t.titulo}: ${ESTADO_TEMA[t.estado]}`}
              className={`flex h-[1.4rem] min-w-[1.6rem] items-center justify-center rounded-md px-1 text-[0.68rem] font-extrabold tabular-nums ${t.estado === 'empieza' ? 'animate-pulse' : ''}`}
              style={{
                border: `1.5px solid ${t.estado === 'espera' ? '#D4C8BE' : INK}`,
                background: t.estado === 'listo' ? '#8BA888' : t.estado === 'fallo' ? '#D4667A' : t.estado === 'empieza' ? 'var(--cia-acc)' : '#FFFFFF',
                color: t.estado === 'espera' ? '#7D8A96' : '#FFFFFF',
              }}
            >
              {i + 1}
            </li>
          ))}
        </ol>
      )}

      <Consejos herramienta={herramienta} />
      <p className="mt-3 flex items-center gap-1.5 text-[0.72rem] text-[#7D8A96]">
        <span className="material-symbols-outlined text-[15px]" aria-hidden>info</span>
        No cierres esta pestaña hasta que termine.
      </p>
    </div>
  )
}

function Consejos({ herramienta }: { herramienta: HerramientaIA }) {
  const lista = CONSEJOS[herramienta]
  const [i, setI] = useState(0)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const ciclo = setInterval(() => {
      setVisible(false)
      t = setTimeout(() => {
        setI((n) => (n + 1) % lista.length)
        setVisible(true)
      }, 350)
    }, 5200)
    return () => {
      clearInterval(ciclo)
      if (t) clearTimeout(t)
    }
  }, [lista.length])
  return (
    <div className="mt-3.5 flex items-end gap-2">
      <Image src="/img/mascota/hablando.png" alt="" width={60} height={60} className="cia-flota shrink-0 object-contain" />
      <p className="relative min-h-[44px] flex-1 rounded-2xl rounded-bl-[4px] bg-white px-3 py-2 text-[0.75rem] leading-snug text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
        <span className="cia-consejo" style={{ opacity: visible ? 1 : 0 }}>{lista[i]}</span>
      </p>
    </div>
  )
}

/** Antes de que llegue nada: una hoja que se va leyendo. */
function EscenaLeyendo({ texto }: { texto: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <svg viewBox="0 0 80 96" width="74" height="88" aria-hidden="true">
        <rect x="6" y="4" width="68" height="88" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <rect key={r} x="16" y={18 + r * 11} width={r % 3 === 2 ? 30 : 48} height="4" rx="2" fill="#C9D1D8" />
        ))}
        <rect x="10" y="14" width="60" height="10" rx="3" fill="var(--cia-acc)" opacity=".35">
          <animate attributeName="y" values="14;72;14" dur="2.4s" repeatCount="indefinite" />
        </rect>
      </svg>
      <p className="text-[0.78rem] font-semibold text-[#7D8A96]">{texto}</p>
    </div>
  )
}

const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Mapa: el árbol que va llegando (los últimos bloques, para que siempre se vea lo nuevo). */
function EscenaArbol({ arbol }: { arbol: RamaProvisional[] }) {
  const bloques = arbol.slice(-4)
  const W = 520
  const H = 226
  const raiz = { x: 62, y: H / 2, w: 96 }
  const filaB = (i: number) => (bloques.length === 1 ? H / 2 : 30 + (i * (H - 60)) / Math.max(1, bloques.length - 1))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label="Mapa provisional">
      {bloques.map((b, i) => {
        const y = filaB(i)
        const hijos = b.hijos.slice(-2)
        return (
          <g key={b.key}>
            <path className="cia-edge" d={`M${raiz.x + raiz.w / 2} ${raiz.y} C ${raiz.x + raiz.w / 2 + 40} ${raiz.y}, ${190 - 40} ${y}, ${190} ${y}`} />
            {hijos.map((h, j) => {
              const yh = y - 12 + j * 24 - (hijos.length === 1 ? -12 : 0)
              return (
                <g key={h.key}>
                  <path className="cia-edge" d={`M${190 + 116} ${y} C ${330} ${y}, ${334} ${yh}, ${352} ${yh}`} />
                  <g className="cia-nodo">
                    <rect x="352" y={yh - 10} width="160" height="20" rx="7" fill="#FAF7F4" stroke={INK} strokeWidth="1.8" />
                    <text x="360" y={yh + 4} fontSize="10" fontWeight="600" fill={INK}>{corto(h.t, 26)}</text>
                  </g>
                </g>
              )
            })}
            <g className="cia-nodo">
              <rect x="190" y={y - 12} width="116" height="24" rx="8" fill="#fff" stroke={INK} strokeWidth="2" />
              <text x="198" y={y + 4} fontSize="10.5" fontWeight="800" fill={INK}>{corto(b.t, 17)}</text>
            </g>
          </g>
        )
      })}
      <g className="cia-nodo">
        <rect x={raiz.x - raiz.w / 2} y={raiz.y - 13} width={raiz.w} height="26" rx="9" fill="var(--cia-acc)" stroke={INK} strokeWidth="2" />
        <text x={raiz.x} y={raiz.y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">Tu mapa</text>
      </g>
    </svg>
  )
}

/** Flashcards: las preguntas que llegan, en un montón; arriba, el tema en el que está. */
function EscenaTarjetas({ lineas }: { lineas: LineaProvisional[] }) {
  const preguntas = lineas.filter((l) => l.d >= 2)
  const tema = [...lineas].reverse().find((l) => l.d <= 1)?.t
  const ultimas = preguntas.slice(-5)
  const base = preguntas.length - ultimas.length
  return (
    <div className="absolute inset-0" aria-label="Tarjetas provisionales">
      {tema && (
        <span className="absolute left-3 top-3 max-w-[60%] truncate rounded-full px-2.5 py-1 text-[0.7rem] font-bold" style={{ background: 'var(--cia-soft)', color: 'var(--cia-ink)' }}>
          {tema}
        </span>
      )}
      {ultimas.map((p, i) => {
        const n = base + i
        const giro = ((n % 5) - 2) * 2.5
        return (
          <div key={n} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -46%) translate(${((n % 3) - 1) * 6}px, ${-i * 3}px) rotate(${giro}deg)` }}>
            <div
              className="cia-tarjeta flex h-[104px] w-[210px] flex-col gap-1.5 rounded-[14px] bg-white px-3 py-2.5"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              <span className="h-1.5 w-9 rounded-full" style={{ background: 'var(--cia-acc)' }} />
              <span className="line-clamp-3 text-[0.78rem] font-bold leading-snug text-[#2C3E50]">{p.t}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Resumen: el último párrafo que llega, palabra a palabra, con algunos datos tapados. */
function EscenaParrafo({ lineas }: { lineas: LineaProvisional[] }) {
  const parrafos = lineas.filter((l) => l.d >= 2)
  const ultimo = parrafos[parrafos.length - 1]
  const tema = [...lineas].reverse().find((l) => l.d <= 1)?.t
  const palabras = (ultimo?.t ?? '').split(/\s+/).filter(Boolean).slice(0, 60)
  return (
    <div className="absolute inset-0 px-5 pb-10 pt-3" aria-label="Párrafo provisional">
      {tema && (
        <span className="mb-2 inline-block max-w-full truncate rounded-full px-2.5 py-1 text-[0.7rem] font-bold" style={{ background: 'var(--cia-soft)', color: 'var(--cia-ink)' }}>
          {tema}
        </span>
      )}
      <p key={parrafos.length} className="line-clamp-6 text-[0.82rem] leading-[1.9] text-[#2C3E50]">
        {palabras.map((w, i) => {
          // Solo es una vista: se tapan cifras y palabras largas, como haría un hueco.
          const hueco = /\d/.test(w) || (w.length > 9 && i % 4 === 1)
          const estilo = { animationDelay: `${Math.min(i, 50) * 45}ms` } as CSSProperties
          return hueco ? (
            <span key={i}>
              <span className="cia-hueco px-2" style={estilo}>{w}</span>{' '}
            </span>
          ) : (
            <span key={i} className="cia-palabra" style={estilo}>{w} </span>
          )
        })}
      </p>
    </div>
  )
}
