'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { INK, ProgresoIA } from '@/components/mapas/ia/ProgresoIA'
import { VistaPreviaFlashcards, type MasConfig } from '@/components/flashcards/ia/VistaPreviaFlashcards'
import { NivelBadge } from '@/components/flashcards/ia/NivelBadge'
import { leerDocumento, type DocumentoGuardado } from '@/lib/mapas/ia/docs'
import { fragmentoParaRama, ramaDeNodo } from '@/lib/mapas/ia/rama'
import { aplicarEvento, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { flashcardsIAEstado, flashcardsIAGenerar, flashcardsIAMas } from '@/lib/flashcards/ia/api'
import {
  acotarFragmento,
  borradores,
  DENSIDADES,
  DESCRIPCION_NIVEL,
  envioDeBloques,
  mapaEnteroParaFlashcards,
  mapaParaFlashcards,
  nodoDeTema,
  raizDelMapa,
  tarjetasAproxMapa,
  type Borrador,
  type Densidad,
  type EstadoFlashcardsIA,
} from '@/lib/flashcards/ia/tarjetas'
import { FLASHCARD_LEVELS, LEVEL_INFO, type FlashcardLevel } from '@/lib/studioFlashcards'
import { supabase } from '@/lib/supabaseBrowser'
import { borrarBorrador, claveBorrador, guardarBorrador, haceCuanto, leerBorrador, type BorradorGuardado } from '@/lib/flashcards/ia/borrador'
import type { FuenteGuardar } from '@/lib/flashcards/ia/tarjetas'

// «Flashcards con IA» desde una rama del mapa (clic derecho en un nodo): al servidor viaja la rama
// en texto plano (con las filas de sus tablas) y, si este navegador guarda el documento del que
// salió el mapa, el FRAGMENTO de sus páginas (para que la IA precise cifras y matices). Luego, la
// misma vista previa que desde un documento. Nada se guarda hasta aprobarla.
//
// Paquete 2: también el MAPA ENTERO (botón «Flashcards con IA» de la barra sin nada seleccionado, o
// «Hacer también las flashcards» del banner de un mapa recién generado): con el documento entero si
// cabe en el tope de un documento y, si no, «Qué parte usar» por bloques del mapa (cada bloque con el
// fragmento de sus páginas). Y «Más de este tema» en la vista previa: la rama del tema y su fragmento.

type Fase = 'ajustes' | 'generando' | 'vista'

// Lo que se manda al ampliar un tema desde un mapa: el tope del servidor (60.000) con margen.
const MAX_MAS = 55000

/**
 * Abre el diálogo: con UN nodo seleccionado, su rama; si no (o si `entero`), el mapa entero.
 * Lo usan el botón de la barra y el banner del mapa recién generado.
 */
export function abrirFlashcardsIA(entero = false) {
  const nodes = useMindMapStore.getState().nodes
  const sel = entero ? [] : nodes.filter((n) => n.selected && !n.hidden)
  const id = sel.length === 1 ? sel[0].id : raizDelMapa(nodes)
  if (id) useUIStore.getState().setFlashcardsIA(id)
}

export function FlashcardsIADesdeMapa({ mapTitle }: { mapTitle: string }) {
  const from = useUIStore((s) => s.flashcardsIA)
  if (!from) return null
  return <Dialogo key={from} nodeId={from} mapTitle={mapTitle} />
}

function Dialogo({ nodeId, mapTitle }: { nodeId: string; mapTitle: string }) {
  const cerrarDialogo = () => useUIStore.getState().setFlashcardsIA(null)
  const mapaId = useUIStore((s) => s.mapaId)
  const fuente = useUIStore((s) => s.fuente)
  const [rama] = useState(() => mapaParaFlashcards(useMindMapStore.getState().nodes, nodeId))
  const esRaiz = useState(() => !useMindMapStore.getState().nodes.find((n) => n.id === nodeId)?.data.parentId)[0]
  // Desde la raíz es el mapa ENTERO: documento entero si cabe; si no, por bloques.
  const entero = esRaiz
  const [elegidos, setElegidos] = useState<Set<string> | null>(null)
  const [masUsadas, setMasUsadas] = useState(0)
  const [estado, setEstado] = useState<EstadoFlashcardsIA | null>(null)
  const [doc, setDoc] = useState<DocumentoGuardado | null | undefined>(undefined)
  const [conDocumento, setConDocumento] = useState(true)
  const [niveles, setNiveles] = useState<FlashcardLevel[]>([...FLASHCARD_LEVELS])
  const [densidad, setDensidad] = useState<Densidad>('normal')
  const [fase, setFase] = useState<Fase>('ajustes')
  const [faseIA, setFaseIA] = useState<FaseIA>('leyendo')
  const [lineas, setLineas] = useState<LineaProvisional[]>([])
  const [segundos, setSegundos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lista, setLista] = useState<Borrador[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const montado = useRef(true)
  // Borrador de este mapa en este navegador (uno por mapa): se guarda al generar y en cada cambio.
  const [usuario, setUsuario] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<BorradorGuardado | null>(null)
  const [revisando, setRevisando] = useState<{ fuente: FuenteGuardar; nombre: string; titulo: string; creado?: number } | null>(null)
  const origen = useMemo(() => (mapaId ? ({ tipo: 'mapa', mapId: mapaId, nodeId } as const) : null), [mapaId, nodeId])

  useEffect(() => {
    let vivo = true
    void supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null
      if (!vivo) return
      setUsuario(uid)
      if (uid && mapaId) void leerBorrador(claveBorrador(uid, { tipo: 'mapa', mapId: mapaId })).then((b) => vivo && setPendiente(b))
    })
    return () => {
      vivo = false
    }
  }, [mapaId])

  const persistir = useCallback(
    (l: Borrador[], r?: { fuente: FuenteGuardar; nombre: string; titulo: string; creado?: number }) => {
      const base = r ?? revisando
      if (!usuario || !origen || !base) return
      void guardarBorrador({
        usuario,
        origen: pendiente?.origen ?? origen,
        titulo: base.titulo,
        nombreGrupo: base.nombre,
        fuente: base.fuente,
        lista: l,
        fallidos: [],
        ...(base.creado ? { creado: base.creado } : {}),
      })
    },
    [usuario, origen, revisando, pendiente],
  )

  useEffect(() => {
    montado.current = true
    void flashcardsIAEstado().then((e) => montado.current && setEstado(e))
    if (mapaId) void leerDocumento(mapaId).then((d) => montado.current && setDoc(d)).catch(() => montado.current && setDoc(null))
    else setDoc(null)
    return () => {
      montado.current = false
      abortRef.current?.abort()
    }
  }, [mapaId])

  useEffect(() => {
    if (fase !== 'generando') return
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [fase])

  // Esc cierra en los ajustes (no a mitad ni en la vista previa: se perdería lo generado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || fase !== 'ajustes') return
      e.stopPropagation()
      cerrarDialogo()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [fase])

  const fragmento = useMemo(
    () => (doc && rama && !entero ? fragmentoParaRama(doc.secciones, rama.paginas, rama.mapa.map((x) => x.t).join(' ')) : []),
    [doc, rama, entero],
  )
  const maxChars = estado?.limites.maxChars ?? 0
  // Mapa entero: con el documento entero si cabe; si no, los bloques elegidos con su fragmento.
  const mapaEntero = useMemo(
    () => (entero && estado && doc !== undefined ? mapaEnteroParaFlashcards(useMindMapStore.getState().nodes, nodeId, conDocumento && doc ? doc.secciones : null, maxChars) : null),
    [entero, estado, doc, conDocumento, nodeId, maxChars],
  )
  // Por defecto, los primeros bloques mientras quepan.
  useEffect(() => {
    if (!mapaEntero || mapaEntero.cabeEntero || elegidos) return
    const sel = new Set<string>()
    let chars = 0
    for (const b of mapaEntero.bloques) {
      if (chars + b.chars > maxChars) break
      sel.add(b.id)
      chars += b.chars
    }
    setElegidos(sel)
  }, [mapaEntero, elegidos, maxChars])
  const envio = useMemo(() => {
    if (!rama) return null
    if (!entero) {
      const secciones = conDocumento ? fragmento : []
      return { mapa: rama.mapa, secciones, hojas: rama.hojas, chars: rama.mapa.reduce((n, x) => n + x.t.length + 1, 0) + secciones.reduce((n, s) => n + s.texto.length, 0) }
    }
    if (!mapaEntero) return null
    if (mapaEntero.cabeEntero) {
      const secciones = conDocumento && doc ? doc.secciones : []
      return { mapa: mapaEntero.todo.mapa, secciones, hojas: mapaEntero.todo.hojas, chars: mapaEntero.charsEntero }
    }
    const bloques = mapaEntero.bloques.filter((b) => elegidos?.has(b.id))
    return envioDeBloques(mapaEntero.titulo || mapTitle, bloques, conDocumento && doc ? doc.secciones : null)
  }, [rama, entero, conDocumento, fragmento, mapaEntero, doc, elegidos, mapTitle])
  const usarDocumento = !!envio && envio.secciones.length > 0
  const caracteres = envio?.chars ?? 0
  const restantes = estado ? Math.max(0, estado.cupo.maxGeneracionesDia - estado.cupo.generacionesHoy) : 0
  const charsRestantes = estado ? Math.max(0, estado.cupo.maxCaracteresDia - estado.cupo.caracteresHoy) : 0
  const excede = !!estado && caracteres > estado.limites.maxChars
  const puede =
    !!envio && envio.hojas > 0 && envio.mapa.length >= 2 && niveles.length > 0 && !!estado && restantes > 0 && caracteres <= charsRestantes && !excede
  const nombre = ((esRaiz ? mapTitle : rama?.titulo) || mapTitle).trim().slice(0, 80)

  const generar = async () => {
    if (!rama || !puede) return
    setError(null)
    setSegundos(0)
    setLineas([])
    setFaseIA('leyendo')
    setFase('generando')
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      if (!envio) return
      const r = await flashcardsIAGenerar(
        {
          titulo: nombre || 'Flashcards',
          niveles,
          densidad,
          mapa: envio.mapa,
          ...(usarDocumento ? { secciones: envio.secciones } : {}),
          ...((doc?.unidad ?? fuente?.unidad) === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
        },
        ctl.signal,
        (e) => {
          if (!montado.current || ctl.signal.aborted) return
          if (e.tipo === 'fase') setFaseIA(e.fase)
          else if (e.tipo === 'rama' || e.tipo === 'reinicio') setLineas((ls) => aplicarEvento(ls, e))
        },
      )
      if (!montado.current) return
      const tarjetas = 'tarjetas' in r ? r.tarjetas : r.temas.flatMap((t) => t.tarjetas)
      if (!tarjetas.length) throw new Error('La IA no devolvió tarjetas válidas para esta rama.')
      // Cada tarjeta, con el nodo de su tema (si está en el mapa): «Abrir la rama» lleva a su tema.
      const nodosMapa = useMindMapStore.getState().nodes
      const nuevas = borradores(tarjetas).map((b) => {
        const n = nodoDeTema(nodosMapa, b.tema, nodeId)
        return n ? { ...b, nodeId: n } : b
      })
      const base = {
        titulo: rama.titulo || mapTitle,
        nombre,
        fuente: {
          ...((doc?.nombre ?? fuente?.nombre) ? { nombre: (doc?.nombre ?? fuente?.nombre ?? '').slice(0, 160) } : {}),
          ...((doc?.unidad ?? fuente?.unidad) === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
          ...(mapaId ? { mapId: mapaId, nodeId } : {}),
        },
      }
      setRevisando(base)
      setPendiente(null)
      setLista(nuevas)
      // Guardado ya: una recarga a mitad de revisión no lo pierde.
      persistir(nuevas, base)
      setFase('vista')
    } catch (e) {
      if (!montado.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'No se pudieron generar las flashcards')
      setFase('ajustes')
    }
  }

  const alternarNivel = (n: FlashcardLevel) => setNiveles((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n].sort()))

  // «Más de este tema» desde el mapa: la rama del nodo de ese tema (dentro de la rama de la que
  // salieron las tarjetas) y, si este navegador guarda el documento, el fragmento de sus páginas.
  const ramaOrigen = (pendiente ?? null)?.origen.tipo === 'mapa' ? ((pendiente?.origen as { nodeId?: string }).nodeId ?? nodeId) : nodeId
  const masRestantes = estado?.cupo.maxMasDia !== undefined ? estado.cupo.maxMasDia - (estado.cupo.masHoy ?? 0) - masUsadas : undefined
  const mas: MasConfig | undefined =
    estado?.disponible && estado.opciones?.ampliar
      ? {
          restantes: masRestantes,
          pedir: async ({ tema, niveles: nv, cantidad, existentes, paginas, vecinos }, signal) => {
            const nodes = useMindMapStore.getState().nodes
            const id = nodoDeTema(nodes, tema, ramaOrigen) ?? (nodes.some((n) => n.id === ramaOrigen) ? ramaOrigen : null)
            const sub = id ? mapaParaFlashcards(nodes, id) : null
            if (!sub || sub.mapa.length < 2) throw new Error('No encuentro ese tema en el mapa (¿se ha borrado o cambiado de nombre?).')
            const textoRama = `${tema} ${sub.mapa.map((x) => x.t).join(' ')}`
            const frag =
              doc && conDocumento ? acotarFragmento(sub.mapa, fragmentoParaRama(doc.secciones, sub.paginas.length ? sub.paginas : paginas, textoRama), MAX_MAS) : []
            const r = await flashcardsIAMas(
              {
                titulo: (revisando?.titulo ?? nombre) || mapTitle,
                niveles: nv,
                // Vecinos: los otros temas de la vista previa y las ramas hermanas del nodo en el mapa.
                ampliar: { tema, cantidad, existentes, vecinos: [...new Set([...vecinos, ...(id ? (ramaDeNodo(nodes, id)?.vecinos ?? []) : [])])].slice(0, 60) },
                mapa: sub.mapa,
                ...(frag.length ? { secciones: frag } : {}),
                ...((doc?.unidad ?? fuente?.unidad) === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
              },
              signal,
            )
            setMasUsadas((n) => n + 1)
            return id ? { ...r, tarjetas: r.tarjetas.map((t) => ({ ...t, nodeId: id })) } : r
          },
        }
      : undefined

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-[#2C3E50]/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && fase === 'ajustes' && cerrarDialogo()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fc-mapa-titulo"
        className={`flex max-h-[92dvh] w-full ${fase === 'vista' ? 'max-w-3xl' : 'max-w-xl'} flex-col overflow-hidden rounded-3xl bg-[#FAF7F4] text-[#2C3E50]`}
        style={{ border: `2px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}` }}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div className="min-w-0">
            <h2 id="fc-mapa-titulo" className="flex items-center gap-2 text-xl font-extrabold text-[#2C3E50]">
              <span aria-hidden className="inline-block text-[#E8A598]">
                <span className="material-symbols-outlined text-[24px] leading-none">auto_awesome</span>
              </span>
              {fase === 'vista' ? 'Revisa las flashcards' : 'Flashcards con IA'}
            </h2>
            <p className="mt-1 truncate text-sm text-[#7D8A96]">{entero ? `Del mapa entero «${mapTitle}»` : `De la rama «${rama?.titulo || mapTitle}»`}</p>
          </div>
          <button
            type="button"
            onClick={cerrarDialogo}
            disabled={fase === 'generando'}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-[#7D8A96] hover:bg-white hover:text-[#2C3E50] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        {fase === 'vista' && lista ? (
          <VistaPreviaFlashcards
            inicial={lista}
            nombreGrupo={revisando?.nombre ?? nombre}
            fuente={revisando?.fuente ?? {}}
            persistir={persistir}
            mas={mas}
            alGuardar={() => usuario && mapaId && void borrarBorrador(claveBorrador(usuario, { tipo: 'mapa', mapId: mapaId }))}
            onVolver={() => setFase('ajustes')}
            onCerrar={cerrarDialogo}
          />
        ) : (
          <>
            <div className="overflow-y-auto px-6 pb-5">
              {error && (
                <div role="alert" className="mb-3 rounded-2xl border border-[#D4667A]/30 bg-[#FAEAED] px-4 py-3 text-sm font-medium text-[#B04A5E]">
                  {error}
                </div>
              )}
              {pendiente && fase === 'ajustes' && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#FBF3E1] px-4 py-3" style={{ border: `2px solid ${INK}` }}>
                  <p className="min-w-0 flex-1 text-sm font-semibold text-[#2C3E50]">
                    Tienes <b>{pendiente.lista.filter((b) => b.incluir).length} tarjetas sin revisar</b> de «{pendiente.titulo}»{' '}
                    <span className="text-[#7D8A96]">({haceCuanto(pendiente.actualizado)})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRevisando({ fuente: pendiente.fuente, nombre: pendiente.nombreGrupo, titulo: pendiente.titulo, creado: pendiente.creado })
                      setLista(pendiente.lista)
                      setFase('vista')
                    }}
                    className="rounded-xl bg-[#E8A598] px-3 py-1.5 text-xs font-extrabold text-white"
                    style={{ border: `2px solid ${INK}` }}
                  >
                    Revisar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('¿Descartar esas tarjetas sin revisar? No se pueden recuperar.')) return
                      void borrarBorrador(pendiente.clave)
                      setPendiente(null)
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs font-bold text-[#7D8A96] hover:text-[#B04A5E]"
                  >
                    Descartar
                  </button>
                </div>
              )}
              {!rama || rama.hojas === 0 || rama.mapa.length < 2 ? (
                <p className="text-sm text-[#7D8A96]">Esta rama no tiene datos debajo. Elige una enfermedad o un bloque con hojas.</p>
              ) : fase === 'generando' ? (
                <>
                  <ProgresoIA
                    fases={['leyendo', 'tarjetas', 'ordenando']}
                    fase={faseIA}
                    lineas={lineas}
                    segundos={segundos}
                    vacio="La IA está leyendo la rama…"
                    contador={(ls) => `${ls.filter((l) => l.d > 1).length} preguntas · se revisan al terminar`}
                  />
                  <p className="mt-2 text-xs text-[#7D8A96]">
                    No cierres esta ventana.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        abortRef.current?.abort()
                        setError('Generación cancelada: la IA ha dejado de trabajar y no cuenta en tus generaciones de hoy.')
                        setFase('ajustes')
                      }}
                      className="font-bold underline hover:text-[#B04A5E]"
                    >
                      Cancelar
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                    <p className="font-bold">
                      {entero && envio ? envio.mapa.length : rama.mapa.length} nodos · {entero && envio ? envio.hojas : rama.hojas}{' '}
                      {(entero && envio ? envio.hojas : rama.hojas) === 1 ? 'hoja' : 'hojas'} con datos
                      {entero && mapaEntero && !mapaEntero.cabeEntero && envio && envio.mapa.length < mapaEntero.todo.mapa.length
                        ? ` (de ${mapaEntero.todo.mapa.length})`
                        : ''}
                    </p>
                    {doc === undefined ? (
                      <p className="mt-1 text-xs text-[#7D8A96]">Buscando el documento del mapa…</p>
                    ) : entero && doc ? (
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-[#7D8A96]">
                        <input
                          type="checkbox"
                          checked={conDocumento}
                          onChange={(e) => {
                            setConDocumento(e.target.checked)
                            setElegidos(null)
                          }}
                          style={{ accentColor: '#E8A598', width: 15, height: 15, marginTop: 1, flexShrink: 0 }}
                        />
                        <span>
                          <b className="text-[#2C3E50]">Usar también el documento</b> («{doc.nombre}»){' '}
                          {mapaEntero?.cabeEntero ? 'entero' : 'de los bloques elegidos'}: la IA precisa cifras y matices con sus páginas. Sigue solo en este navegador.
                        </span>
                      </label>
                    ) : fragmento.length > 0 ? (
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-[#7D8A96]">
                        <input
                          type="checkbox"
                          checked={conDocumento}
                          onChange={(e) => setConDocumento(e.target.checked)}
                          style={{ accentColor: '#E8A598', width: 15, height: 15, marginTop: 1, flexShrink: 0 }}
                        />
                        <span>
                          <b className="text-[#2C3E50]">Usar también el documento</b> («{doc?.nombre}»): la IA precisa cifras y matices con sus páginas. El
                          documento sigue solo en este navegador; viaja el fragmento de esta rama.
                        </span>
                      </label>
                    ) : (
                      <p className="mt-1 text-xs text-[#7D8A96]">Se harán con lo que dice el mapa (este navegador no guarda el documento de origen).</p>
                    )}
                  </div>

                  {entero && mapaEntero && !mapaEntero.cabeEntero && (
                    <div className="mt-3 rounded-2xl bg-white px-4 py-3" style={{ border: `2px solid ${INK}` }}>
                      <p className="text-sm font-extrabold text-[#2C3E50]">Qué parte usar</p>
                      <p className="mt-0.5 text-xs text-[#7D8A96]">
                        El mapa{conDocumento && doc ? ' con su documento' : ''} tiene {mapaEntero.charsEntero.toLocaleString('es-ES')} caracteres y de una vez caben{' '}
                        {maxChars.toLocaleString('es-ES')}. Marca los bloques (cada uno con {conDocumento && doc ? 'el fragmento de sus páginas' : 'sus hojas'}).
                      </p>
                      <ul className="mt-2 max-h-[12rem] space-y-1 overflow-y-auto">
                        {mapaEntero.bloques.map((b) => (
                          <li key={b.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[0.8rem] hover:bg-[#FAF7F4]">
                              <input
                                type="checkbox"
                                checked={!!elegidos?.has(b.id)}
                                onChange={() =>
                                  setElegidos((e) => {
                                    const n = new Set(e ?? [])
                                    if (n.has(b.id)) n.delete(b.id)
                                    else n.add(b.id)
                                    return n
                                  })
                                }
                                style={{ accentColor: '#E8A598', width: 15, height: 15, flexShrink: 0 }}
                              />
                              <span className="min-w-0 flex-1 truncate font-bold text-[#2C3E50]">{b.titulo || 'Bloque'}</span>
                              <span className="shrink-0 text-[0.7rem] text-[#7D8A96]">
                                {b.hojas} hojas · {b.chars.toLocaleString('es-ES')} car.
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[0.72rem] font-semibold text-[#7D8A96]">
                        Marcado: {caracteres.toLocaleString('es-ES')} de {maxChars.toLocaleString('es-ES')} caracteres
                      </p>
                    </div>
                  )}

                  <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Dificultad</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label="Niveles de dificultad">
                    {FLASHCARD_LEVELS.map((n) => {
                      const on = niveles.includes(n)
                      return (
                        <label
                          key={n}
                          className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-white px-3 py-2.5"
                          style={{ border: `2px solid ${on ? LEVEL_INFO[n].color : 'transparent'}` }}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => alternarNivel(n)}
                            style={{ accentColor: LEVEL_INFO[n].color, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                          />
                          <span className="min-w-0">
                            <NivelBadge nivel={n} />
                            <span className="mt-1 block text-xs text-[#7D8A96]">{DESCRIPCION_NIVEL[n]}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Cantidad</p>
                  <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cantidad de tarjetas">
                    {DENSIDADES.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        role="radio"
                        aria-checked={densidad === d.id}
                        onClick={() => setDensidad(d.id)}
                        className="rounded-2xl bg-white p-2.5 text-left"
                        style={{ border: `2px solid ${densidad === d.id ? '#E8A598' : 'transparent'}` }}
                      >
                        <span className="block text-sm font-extrabold text-[#2C3E50]">{d.titulo}</span>
                        <span className="block text-[0.72rem] text-[#7D8A96]">{d.descripcion}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[#7D8A96]" aria-live="polite">
                    {estado
                      ? `Saldrán unas ${tarjetasAproxMapa(envio?.hojas ?? rama.hojas, densidad, niveles.length)} tarjetas; antes de guardarlas las revisas. Hoy te quedan ${restantes} de ${estado.cupo.maxGeneracionesDia} generaciones.`
                      : 'Comprobando tu cupo de IA…'}
                  </p>
                  {excede && (
                    <p className="mt-1 text-xs font-bold text-[#B04A5E]">
                      {entero ? 'Lo marcado es demasiado grande: desmarca algún bloque o quita el documento.' : 'La rama con su documento es demasiado grande: elige una rama más pequeña o quita el documento.'}
                    </p>
                  )}
                  {entero && envio && envio.hojas === 0 && <p className="mt-1 text-xs font-bold text-[#B04A5E]">Marca al menos un bloque.</p>}
                  {estado && restantes === 0 && <p className="mt-1 text-xs font-bold text-[#B04A5E]">Has llegado al máximo de generaciones de hoy.</p>}
                </>
              )}
            </div>
            {fase === 'ajustes' && (
              <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
                <p className="mb-3 text-[11px] leading-relaxed text-[#7D8A96]">
                  {entero ? (usarDocumento ? 'El mapa y su documento se envían' : 'El mapa se envía') : usarDocumento ? 'La rama y el fragmento del documento se envían' : 'La rama se envía'} a un servicio de IA externo (DeepSeek) solo para hacer las tarjetas.
                </p>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={cerrarDialogo} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void generar()}
                    disabled={!puede}
                    className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
                  >
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Generar flashcards
                  </button>
                </div>
              </footer>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes ia-barra{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}@keyframes ia-entra{from{opacity:0;transform:translateX(-0.25rem)}to{opacity:1;transform:none}}.ia-prov-entra{animation:ia-entra .25s ease-out}`}</style>
    </div>
  )
}
