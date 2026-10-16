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
import { CabeceraCrear, OpcionAnimada, type HerramientaIA } from '@/components/ia/crear/Kit'
import { EscenaMapa, EscenaMonton, EscenaParrafo } from '@/components/ia/crear/Escenas'

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
/** Color y textura de cada pestaña (crearIA.css). */
const HERRAMIENTA: Record<Id, HerramientaIA> = { mapa: 'mapa', flashcards: 'flashcards', resumenes: 'resumen' }
const ESCENA: Record<Id, React.ReactNode> = { mapa: <EscenaMapa rico={false} />, flashcards: <EscenaMonton n={4} />, resumenes: <EscenaParrafo literal={false} /> }

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

  // El marco toma el color de la pestaña abierta (en el primer paso, el de mapas: el coral de siempre).
  const tono: HerramientaIA = paso === 'ajustes' && hoy ? HERRAMIENTA[hoy] : 'mapa'
  const datosDoc =
    lectura.estado === 'error'
      ? (lectura.error ?? 'No se pudo leer el archivo.')
      : lectura.estado === 'listo' && doc
        ? `${fmt(doc.extraido.paginas)} ${doc.extraido.unidad ?? 'página'}${doc.extraido.paginas === 1 ? '' : 's'} · ${fmt(doc.extraido.caracteres)} caracteres`
        : lectura.total && lectura.total > 1
          ? `Leyendo… página ${lectura.hecho ?? 0} de ${lectura.total}`
          : `Leyendo… (${tamano(archivo.size)})`
  const botonPrincipal = 'flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-[0.92rem] font-black text-white transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-50'
  const estiloPrincipal = { background: 'var(--cia-boton)', border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C3E50]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && intentarCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-ia-titulo"
        data-cia={tono}
        className={`flex max-h-[92dvh] w-full ${ancho} flex-col overflow-hidden rounded-[28px] bg-[#FAF7F4] transition-[max-width] duration-200`}
        style={{ border: `2px solid ${INK}`, boxShadow: `8px 8px 0 0 ${INK}` }}
      >
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
        <CabeceraCrear
          herramienta={tono}
          icono="auto_awesome"
          idTitulo="hub-ia-titulo"
          titulo={paso === 'elegir' ? 'Crear desde un documento' : 'Tus creaciones'}
          subtitulo={paso === 'elegir' ? 'Elige qué sacar de él: una cosa o las tres.' : 'Ajusta cada una en su pestaña y genéralas.'}
          documento={{ nombre: archivo.name, datos: datosDoc }}
          {...(paso === 'elegir' ? { onCambiarDocumento: () => inputRef.current?.click() } : {})}
          {...(!generando ? { onCerrar: intentarCerrar } : {})}
        />

        {paso === 'elegir' && (
          <>
            <div className="overflow-y-auto px-5 pb-5 pt-4">
              <h3 className="mb-2.5 flex items-center gap-2 text-[0.82rem] font-black text-[#2C3E50]">
                ¿Qué quieres crear?
                <span className="ml-auto text-[0.72rem] font-medium text-[#7D8A96]">Puedes elegir varias</span>
              </h3>
              <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Qué crear">
                {OPCIONES.map((o) => {
                  const ok = disponibles.some((d) => d.id === o.id)
                  return (
                    <div key={o.id} data-cia={HERRAMIENTA[o.id]} className="grid">
                      <OpcionAnimada
                        rol="checkbox"
                        activa={elegidas.includes(o.id)}
                        disabled={!ok}
                        onElegir={() => alternar(o.id)}
                        titulo={o.titulo}
                        descripcion={ok ? o.descripcion : 'No está disponible para tu cuenta.'}
                        escena={ESCENA[o.id]}
                      />
                    </div>
                  )
                })}
              </div>
              {elegidas.length > 1 && (
                <p className="mt-3 flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#8A6418]">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>queue</span>
                  La IA hace una cosa cada vez: las {elegidas.length} se harán una detrás de otra.
                </p>
              )}
            </div>
            <footer className="flex shrink-0 items-center justify-end gap-3 bg-white px-5 py-3.5" style={{ borderTop: `2px solid ${INK}` }}>
              <p className="mr-auto flex items-start gap-1.5 text-[0.68rem] leading-snug text-[#7D8A96]">
                <span className="material-symbols-outlined text-[14px]" aria-hidden>lock</span>
                El documento se lee en tu navegador: no se sube ni se guarda.
              </p>
              <button type="button" onClick={continuar} disabled={!doc || elegidas.length === 0} className={botonPrincipal} style={estiloPrincipal}>
                {lectura.estado === 'leyendo' ? 'Leyendo el documento…' : 'Continuar'}
                {lectura.estado !== 'leyendo' && <span className="material-symbols-outlined text-[20px]" aria-hidden>arrow_forward</span>}
              </button>
            </footer>
          </>
        )}

        {paso === 'ajustes' && doc && (
          <>
            <div role="tablist" aria-label="Qué se va a crear" className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-1 pt-3.5">
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
                    data-cia={HERRAMIENTA[id]}
                    className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-white py-2 pl-2 pr-3.5 text-left transition-transform hover:-translate-y-px disabled:opacity-50"
                    style={{ border: `2px solid ${on ? INK : '#EDE6DE'}`, boxShadow: on ? '3px 3px 0 0 var(--cia-acc)' : 'none' }}
                  >
                    <span
                      className="grid size-8 place-items-center rounded-[10px] text-white"
                      style={{ background: 'var(--cia-acc)', border: `2px solid ${INK}` }}
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{o.icono}</span>
                    </span>
                    <span>
                      <span className="block text-[0.82rem] font-extrabold text-[#2C3E50]">{o.titulo}</span>
                      <span className="flex items-center gap-1 text-[0.68rem] font-bold" style={{ color: TONO[et.tono] }}>
                        {et.tono === 'curso' && <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: TONO[et.tono] }} />}
                        {et.tono === 'ok' && <span className="material-symbols-outlined text-[13px]" aria-hidden>check_circle</span>}
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

            <footer className="shrink-0 bg-white px-5 pb-3 pt-3.5" style={{ borderTop: `2px solid ${INK}` }}>
              {(aviso || (faltaMsg && pendientes.length > 0 && !generando)) && (
                <p role="status" className={`mb-2.5 flex items-center gap-1.5 text-[0.75rem] font-bold ${aviso ? 'text-[#B04A5E]' : 'text-[#B07A1E]'}`}>
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>{aviso ? 'error' : 'info'}</span>
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
                    className="mr-auto flex items-center gap-1 rounded-xl px-2 py-2 text-[0.8rem] font-bold text-[#7D8A96] hover:text-[#2C3E50]"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_back</span>
                    Cambiar la selección
                  </button>
                )}
                {pendientes.length > 1 && hoy && repo(hoy).fase === 'ajustes' && (
                  <button
                    type="button"
                    onClick={() => void lanzar([hoy])}
                    disabled={!hoyListo}
                    className="rounded-2xl bg-white px-4 py-2.5 text-[0.85rem] font-bold text-[#2C3E50] disabled:opacity-40"
                    style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                  >
                    Solo «{NOMBRE[hoy]}»
                  </button>
                )}
                {pendientes.length === 0 && !generando && (
                  <button
                    type="button"
                    onClick={intentarCerrar}
                    className="rounded-2xl bg-white px-4 py-2.5 text-[0.85rem] font-bold text-[#2C3E50]"
                    style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                  >
                    Cerrar
                  </button>
                )}
                {pendientes.length > 0 && (
                  <button type="button" onClick={() => void lanzar(pendientes)} disabled={!puedeTodo} className={botonPrincipal} style={estiloPrincipal}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>auto_awesome</span>
                    {generando ? 'Generando…' : pendientes.length > 1 ? `Generar las ${pendientes.length}` : 'Generar'}
                  </button>
                )}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[0.68rem] leading-snug text-[#7D8A96]">
                <span className="material-symbols-outlined text-[14px]" aria-hidden>lock</span>
                Tu archivo no se guarda. El texto va a la IA (DeepSeek) solo para generar; revisa el resultado antes de estudiar con él.
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
