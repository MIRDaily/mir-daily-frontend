'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { ExtractError, type EstadoIA } from '@/lib/mapas/ia/types'
import type { EstadoFlashcardsIA } from '@/lib/flashcards/ia/tarjetas'
import type { EstadoResumenesIA } from '@/lib/resumenes/ia'
import type { ControlEmbebido, DocumentoCompartido, EstadoEmbebido } from '@/lib/ia/embebido'
import { INK } from '@/components/mapas/ia/ProgresoIA'
import CrearConIA from '@/components/mapas/ia/CrearConIA'
import CrearFlashcardsIA from '@/components/flashcards/ia/CrearFlashcardsIA'
import CrearResumenesIA from '@/components/resumenes/CrearResumenesIA'

// «Crear desde un documento» (Studio): se suelta un PDF, Word o PowerPoint y se elige qué sacar de él
// —mapa conceptual, flashcards, resumen activo, una cosa o las tres—. Dos pasos:
//   1. Qué crear (el documento se lee en el navegador mientras tanto, UNA sola vez).
//   2. Los ajustes de cada una en su pestaña: son los mismos diálogos de «Crear con IA» de cada modo,
//      con sus mismos ajustes, generación y revisión (aquí sin marco, sobre el documento ya leído).
// El servidor solo deja una generación a la vez por usuario (reserva común a los tres), así que
// «Generar todo» las lanza EN COLA: cada una empieza cuando termina la anterior, y lo que necesita
// revisión (flashcards, resúmenes) queda esperando en su pestaña mientras se genera lo siguiente.

export type EstadosIA = { mapa: EstadoIA | null; flashcards: EstadoFlashcardsIA | null; resumenes: EstadoResumenesIA | null }
type Id = 'mapa' | 'flashcards' | 'resumenes'

const OPCIONES: { id: Id; titulo: string; descripcion: string; icono: string }[] = [
  { id: 'mapa', titulo: 'Mapa conceptual', descripcion: 'Un mapa mental con las ramas del documento, por tema.', icono: 'account_tree' },
  { id: 'flashcards', titulo: 'Flashcards', descripcion: 'Tarjetas cortas de pregunta y respuesta, de fácil a demencial.', icono: 'style' },
  { id: 'resumenes', titulo: 'Resumen activo', descripcion: 'Párrafos con huecos para repasar y recordar.', icono: 'text_snippet' },
]
const NOMBRE: Record<Id, string> = { mapa: 'Mapa conceptual', flashcards: 'Flashcards', resumenes: 'Resumen activo' }

const SIN_REPORTAR: EstadoEmbebido = { fase: 'ajustes', listo: false }
const fmt = (n: number) => n.toLocaleString('es-ES')
const tamano = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1000))} KB`)

type Lectura = { estado: 'leyendo' | 'listo' | 'error'; hecho?: number; total?: number; error?: string }

export default function DocumentoIAHub({ archivo: archivoInicial, estados, onClose }: { archivo: File; estados: EstadosIA; onClose: () => void }) {
  const [archivo, setArchivo] = useState(archivoInicial)
  const [doc, setDoc] = useState<DocumentoCompartido | null>(null)
  const [lectura, setLectura] = useState<Lectura>({ estado: 'leyendo' })
  const [paso, setPaso] = useState<'elegir' | 'ajustes'>('elegir')
  const [elegidas, setElegidas] = useState<Id[]>([])
  const [pestana, setPestana] = useState<Id | null>(null)
  const [reportes, setReportes] = useState<Partial<Record<Id, EstadoEmbebido>>>({})
  const [cerradas, setCerradas] = useState<Id[]>([])
  const [cola, setCola] = useState<Id[]>([])
  const [actual, setActual] = useState<Id | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const montado = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const refMapa = useRef<ControlEmbebido>(null)
  const refFlashcards = useRef<ControlEmbebido>(null)
  const refResumenes = useRef<ControlEmbebido>(null)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const disponibles = OPCIONES.filter((o) => (o.id === 'mapa' ? estados.mapa : o.id === 'flashcards' ? estados.flashcards : estados.resumenes))
  // Se lee más de lo que cabe en una sola generación (para poder elegir una parte o ir tema a tema):
  // lo que pida el más generoso de los modos disponibles.
  const topeLectura = useMemo(() => {
    const lim = [estados.mapa?.limites, estados.flashcards?.limites, estados.resumenes?.limites].filter((l): l is NonNullable<typeof l> => !!l)
    return Math.max(1, ...lim.map((l) => Math.max(l.maxChars * 4, l.maxCharsLibro ?? 0)))
  }, [estados])

  // El documento se lee en cuanto se suelta, mientras se elige qué crear.
  useEffect(() => {
    let vivo = true
    extraerDocumento(archivo, { maxChars: topeLectura, onProgreso: (hecho, total) => vivo && setLectura({ estado: 'leyendo', hecho, total }) })
      .then((extraido) => {
        if (!vivo) return
        setDoc({ archivo, extraido })
        setLectura({ estado: 'listo' })
      })
      .catch((e) => {
        if (vivo) setLectura({ estado: 'error', error: e instanceof ExtractError ? e.message : 'No se pudo leer el archivo.' })
      })
    return () => {
      vivo = false
    }
  }, [archivo, topeLectura])

  const cambiarArchivo = (f: File | undefined) => {
    if (!f) return
    setDoc(null)
    setLectura({ estado: 'leyendo' })
    setArchivo(f)
  }

  const repo = (id: Id): EstadoEmbebido => reportes[id] ?? SIN_REPORTAR
  const abiertas = elegidas.filter((id) => !cerradas.includes(id))
  const generando = actual !== null || abiertas.some((id) => repo(id).fase === 'generando')
  const porRevisar = abiertas.some((id) => repo(id).fase === 'vista')
  const empezado = abiertas.some((id) => repo(id).fase !== 'ajustes') || cerradas.length > 0

  const intentarCerrar = () => {
    if (generando) return
    if (porRevisar && !window.confirm('Tienes tarjetas o párrafos sin guardar. Se quedan como borrador y los retomas desde Flashcards o Resúmenes activos. ¿Cerrar?')) return
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // En la revisión, Esc es de la revisión (y no se cierra con un gesto suelto).
      if (e.key === 'Escape' && !generando && !porRevisar) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [generando, porRevisar, onClose])

  const alternar = (id: Id) => setElegidas((es) => (es.includes(id) ? es.filter((x) => x !== id) : OPCIONES.map((o) => o.id).filter((x) => x === id || es.includes(x))))

  const continuar = () => {
    if (!doc || elegidas.length === 0) return
    setReportes({})
    setCerradas([])
    setPestana(elegidas[0])
    setPaso('ajustes')
  }

  // Callbacks estables por pestaña (el diálogo los pone en un efecto: si cambiaran, se repetiría).
  const alEstado = useMemo(() => {
    const hacer = (id: Id) => (e: EstadoEmbebido) =>
      setReportes((r) => (r[id]?.fase === e.fase && r[id]?.listo === e.listo && r[id]?.falta === e.falta ? r : { ...r, [id]: e }))
    return { mapa: hacer('mapa'), flashcards: hacer('flashcards'), resumenes: hacer('resumenes') }
  }, [])

  const cerrarPestana = (id: Id) => {
    const quedan = abiertas.filter((x) => x !== id)
    if (quedan.length === 0) return onClose()
    setCerradas((c) => (c.includes(id) ? c : [...c, id]))
    setPestana((p) => (p === id ? quedan[0] : p))
  }

  /** Lanza las generaciones una detrás de otra; si una falla o se cancela, se para la cola. */
  const lanzar = async (ids: Id[]) => {
    if (ids.length === 0 || generando) return
    setAviso(null)
    setCola(ids)
    setPestana(ids[0])
    for (const id of ids) {
      setActual(id)
      const control = { mapa: refMapa, flashcards: refFlashcards, resumenes: refResumenes }[id]
      const r = (await control.current?.generar()) ?? 'no'
      if (!montado.current) return
      if (r === 'fallo' || r === 'cancelado') {
        setAviso(`Se paró en «${NOMBRE[id]}»${r === 'fallo' ? ': no se pudo generar (mira el mensaje de su pestaña)' : ': la cancelaste'}. Lo que quedaba en cola no se ha generado.`)
        break
      }
    }
    setActual(null)
    setCola([])
  }

  const pendientes = abiertas.filter((id) => repo(id).fase === 'ajustes')
  const sinListo = pendientes.filter((id) => !repo(id).listo)
  const puedeTodo = pendientes.length > 0 && sinListo.length === 0 && !generando
  const faltaMsg = sinListo.length ? `${NOMBRE[sinListo[0]]}: ${repo(sinListo[0]).falta ?? 'revisa sus ajustes'}` : null
  const hoy = pestana && abiertas.includes(pestana) ? pestana : (abiertas[0] ?? null)
  const hoyListo = !!hoy && repo(hoy).fase === 'ajustes' && repo(hoy).listo && !generando

  const etiqueta = (id: Id): { texto: string; tono: 'ok' | 'aviso' | 'curso' | 'neutro' } => {
    if (cerradas.includes(id)) return { texto: 'Cerrada', tono: 'neutro' }
    const e = repo(id)
    if (e.fase === 'generando') return { texto: 'Generando…', tono: 'curso' }
    if (e.fase === 'vista') return { texto: 'Para revisar', tono: 'ok' }
    if (e.fase === 'hecho') return { texto: 'Lista', tono: 'ok' }
    if (cola.includes(id) && actual !== id) return { texto: 'En cola', tono: 'curso' }
    return e.listo ? { texto: 'Ajustes listos', tono: 'neutro' } : { texto: 'Faltan ajustes', tono: 'aviso' }
  }
  const TONO = { ok: '#5E8C5A', aviso: '#B07A1E', curso: '#C97D6F', neutro: '#7D8A96' } as const

  const anchoVista = hoy ? repo(hoy).fase === 'vista' : false
  const ancho = paso === 'elegir' ? 'max-w-xl' : anchoVista ? 'max-w-4xl' : 'max-w-2xl'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && intentarCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-ia-titulo"
        className={`flex max-h-[92dvh] w-full ${ancho} flex-col overflow-hidden rounded-3xl bg-[#FAF7F4] transition-[max-width] duration-200`}
        style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div className="min-w-0">
            <h2 id="hub-ia-titulo" className="flex items-center gap-2 text-xl font-extrabold text-[#2C3E50]">
              <span aria-hidden className="inline-block text-[#E8A598]">
                <span className="material-symbols-outlined text-[24px] leading-none">auto_awesome</span>
              </span>
              {paso === 'elegir' ? 'Crear desde un documento' : 'Ajustes de cada creación'}
            </h2>
            <p className="mt-1 truncate text-sm text-[#7D8A96]">
              {paso === 'elegir' ? 'Elige qué quieres sacar de él: una cosa o las tres.' : archivo.name}
            </p>
          </div>
          <button
            type="button"
            onClick={intentarCerrar}
            disabled={generando}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-[#7D8A96] transition-colors hover:bg-white hover:text-[#2C3E50] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        {paso === 'elegir' && (
          <>
            <div className="overflow-y-auto px-6 pb-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                <span className={`material-symbols-outlined text-[28px] text-[#E8A598] ${lectura.estado === 'leyendo' ? 'animate-pulse' : ''}`}>description</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#2C3E50]">{archivo.name}</p>
                  <p className={`text-xs ${lectura.estado === 'error' ? 'font-bold text-[#B04A5E]' : 'text-[#7D8A96]'}`} aria-live="polite">
                    {lectura.estado === 'error'
                      ? lectura.error
                      : lectura.estado === 'listo' && doc
                        ? `${fmt(doc.extraido.paginas)} ${doc.extraido.unidad ?? 'página'}${doc.extraido.paginas === 1 ? '' : 's'} · ${fmt(doc.extraido.caracteres)} caracteres`
                        : lectura.total && lectura.total > 1
                          ? `Leyendo… página ${lectura.hecho ?? 0} de ${lectura.total}`
                          : `Leyendo… (${tamano(archivo.size)})`}
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={FORMATOS_ACEPTADOS}
                  className="hidden"
                  onChange={(e) => {
                    cambiarArchivo(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-bold text-[#7D8A96] hover:text-[#E8A598]">
                  Cambiar
                </button>
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">¿Qué quieres crear?</p>
              <div className="mt-2 flex flex-col gap-2" role="group" aria-label="Qué crear">
                {OPCIONES.map((o) => {
                  const ok = disponibles.some((d) => d.id === o.id)
                  const on = elegidas.includes(o.id)
                  return (
                    <label
                      key={o.id}
                      className={`flex items-start gap-3 rounded-2xl bg-white px-4 py-3 ${ok ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}
                      style={{ border: `2px solid ${on ? '#E8A598' : 'transparent'}` }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!ok}
                        onChange={() => alternar(o.id)}
                        style={{ accentColor: '#E8A598', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                      />
                      <span aria-hidden className="inline-block text-[#E8A598]">
                        <span className="material-symbols-outlined text-[1.6rem] leading-none">{o.icono}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold text-[#2C3E50]">{o.titulo}</span>
                        <span className="block text-xs text-[#7D8A96]">{ok ? o.descripcion : 'No está disponible para tu cuenta.'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {elegidas.length > 1 && (
                <p className="mt-3 rounded-xl bg-[#FBF3E1] px-3 py-2 text-[0.78rem] font-semibold text-[#8A6418]">
                  La IA hace una cosa cada vez: al generar, las {elegidas.length} se harán una detrás de otra.
                </p>
              )}
            </div>
            <footer className="flex shrink-0 justify-end gap-3 border-t border-[#7D8A96]/15 bg-white px-6 py-4">
              <button type="button" onClick={intentarCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
                Cancelar
              </button>
              <button
                type="button"
                onClick={continuar}
                disabled={!doc || elegidas.length === 0}
                className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d18d80] disabled:opacity-50"
              >
                {lectura.estado === 'leyendo' ? 'Leyendo el documento…' : 'Continuar'}
                {lectura.estado !== 'leyendo' && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
              </button>
            </footer>
          </>
        )}

        {paso === 'ajustes' && doc && (
          <>
            <div role="tablist" aria-label="Qué se va a crear" className="flex shrink-0 gap-2 overflow-x-auto px-6 pb-3">
              {elegidas.map((id) => {
                const o = OPCIONES.find((x) => x.id === id)!
                const et = etiqueta(id)
                const on = hoy === id
                const cerrada = cerradas.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    disabled={cerrada}
                    onClick={() => setPestana(id)}
                    className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left disabled:opacity-60"
                    style={{ border: `2px solid ${on ? '#E8A598' : 'transparent'}` }}
                  >
                    <span aria-hidden className="inline-block text-[#E8A598]">
                      <span className="material-symbols-outlined text-[1.3rem] leading-none">{o.icono}</span>
                    </span>
                    <span>
                      <span className="block text-sm font-extrabold text-[#2C3E50]">{o.titulo}</span>
                      <span className="flex items-center gap-1 text-[0.7rem] font-bold" style={{ color: TONO[et.tono] }}>
                        {et.tono === 'curso' && <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: TONO[et.tono] }} />}
                        {et.texto}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Los tres diálogos siguen montados aunque estén ocultos: no pierden sus ajustes ni su revisión. */}
            {elegidas.includes('mapa') && !cerradas.includes('mapa') && estados.mapa && (
              <CrearConIA
                estado={estados.mapa}
                compartido={doc}
                visible={hoy === 'mapa'}
                controlRef={refMapa}
                onEstado={alEstado.mapa}
                onClose={() => cerrarPestana('mapa')}
              />
            )}
            {elegidas.includes('flashcards') && !cerradas.includes('flashcards') && estados.flashcards && (
              <CrearFlashcardsIA
                estado={estados.flashcards}
                compartido={doc}
                visible={hoy === 'flashcards'}
                controlRef={refFlashcards}
                onEstado={alEstado.flashcards}
                onClose={() => cerrarPestana('flashcards')}
              />
            )}
            {elegidas.includes('resumenes') && !cerradas.includes('resumenes') && estados.resumenes && (
              <CrearResumenesIA
                estado={estados.resumenes}
                compartido={doc}
                visible={hoy === 'resumenes'}
                controlRef={refResumenes}
                onEstado={alEstado.resumenes}
                onClose={() => cerrarPestana('resumenes')}
              />
            )}

            <footer className="shrink-0 border-t border-[#7D8A96]/15 bg-white px-6 py-3">
              <p className="mb-2 text-[11px] leading-relaxed text-[#7D8A96]">
                Los archivos no se guardan ni se suben: se leen en tu navegador y su texto se envía a un servicio de IA externo (DeepSeek) solo para generar lo que
                pides. La IA puede equivocarse: revisa el resultado antes de estudiar con él.
              </p>
              {(aviso || (faltaMsg && pendientes.length > 0 && !generando)) && (
                <p role="status" className={`mb-2 text-xs font-bold ${aviso ? 'text-[#B04A5E]' : 'text-[#B07A1E]'}`}>
                  {aviso ?? faltaMsg}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-3">
                {empezado || generando ? (
                  <span className="mr-auto" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPaso('elegir')}
                    className="mr-auto rounded-2xl px-3 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]"
                  >
                    ← Cambiar la selección
                  </button>
                )}
                {pendientes.length > 1 && hoy && repo(hoy).fase === 'ajustes' && (
                  <button
                    type="button"
                    onClick={() => void lanzar([hoy])}
                    disabled={!hoyListo}
                    className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#2C3E50] disabled:opacity-40"
                    style={{ border: `2px solid ${INK}` }}
                  >
                    Solo «{NOMBRE[hoy]}»
                  </button>
                )}
                {pendientes.length === 0 && !generando && (
                  <button type="button" onClick={intentarCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
                    Cerrar
                  </button>
                )}
                {pendientes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void lanzar(pendientes)}
                    disabled={!puedeTodo}
                    className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d18d80] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    {generando ? 'Generando…' : pendientes.length > 1 ? `Generar las ${pendientes.length}` : 'Generar'}
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
