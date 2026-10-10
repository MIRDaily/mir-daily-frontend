'use client'

// Un grupo de resúmenes activos: sus párrafos por tema (con su estado de repaso), buscarlos, filtrarlos
// y ordenarlos, editarlos, borrarlos o escribir uno nuevo, seleccionar varios para moverlos, copiarlos,
// cambiarles el tema o borrarlos de una vez, y estudiar con ajustes de la sesión. `?estudiar=1` abre
// los ajustes al llegar (desde «Estudiar» en la lista o «Empezar a estudiar» tras la IA).

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { GhostButton, Hero, StatChip, StickerButton, StickerCard } from '@/components/ui/sticker'
import { EditorParrafo } from '@/components/resumenes/EditorParrafo'
import { EstudioResumen } from '@/components/resumenes/EstudioResumen'
import { AjustesEstudio } from '@/components/resumenes/AjustesEstudio'
import { FiltrosGrupo, type ConteosGrupo } from '@/components/resumenes/FiltrosGrupo'
import { Resaltado, TarjetaParrafoGrupo } from '@/components/resumenes/TarjetaParrafoGrupo'
import { BarraBloque } from '@/components/resumenes/BarraBloque'
import { DialogoDestino, type Destino, type FalloDestino } from '@/components/resumenes/DialogoDestino'
import { BaldosaGrupo, ColorIconoGrupo } from '@/components/resumenes/ColorIconoGrupo'
import {
  accionBloque,
  anadirParrafos,
  borrarGrupo,
  cargarGrupo,
  crearGrupo,
  editarGrupo,
  editarParrafo,
  quitarParrafo,
  type CuerpoBloque,
  type GrupoResumen,
  type Parrafo,
} from '@/lib/resumenes/api'
import { AJUSTES_POR_DEFECTO, aPeticion, sanearAjustes, type Ajustes } from '@/lib/resumenes/sesion'
import {
  FILTROS_VACIOS,
  agruparPorTema,
  alternarVarios,
  estadoSeleccion,
  filtrarParrafos,
  mensajeBloque,
  mensajeErrorBloque,
  ordenarParrafos,
  temaDe,
  terminosDe,
  tocaRepasar,
  type FiltrosGrupo as Filtros,
  type OrdenGrupo,
} from '@/lib/resumenes/grupo'

const claveAjustes = (id: string) => `mirdaily-resumenes-ajustes:${id}`
function leerAjustes(id: string): Ajustes {
  try {
    const raw = window.localStorage.getItem(claveAjustes(id))
    return raw ? sanearAjustes(JSON.parse(raw)) : { ...AJUSTES_POR_DEFECTO }
  } catch {
    return { ...AJUSTES_POR_DEFECTO }
  }
}
function guardarAjustes(id: string, a: Ajustes) {
  try {
    window.localStorage.setItem(claveAjustes(id), JSON.stringify(a))
  } catch {
    /* comodidad: si no se puede, la próxima vez salen los de por defecto */
  }
}

const SIN_TERMINOS: string[] = []

/** La casilla de «todo el tema» (de lo que se ve de él): marcada, a medias o vacía. */
function CasillaTema({ ids, seleccion, onAlternar, tema }: { ids: number[]; seleccion: ReadonlySet<number>; onAlternar: (ids: number[]) => void; tema: string }) {
  const e = estadoSeleccion(ids, seleccion)
  return (
    <input
      type="checkbox"
      checked={e === 'todos'}
      ref={(el) => {
        if (el) el.indeterminate = e === 'algunos'
      }}
      onChange={() => onAlternar(ids)}
      aria-label={`Seleccionar los párrafos de «${tema || 'Sin tema'}»`}
      className="h-4 w-4 shrink-0 cursor-pointer accent-[#E8A598]"
    />
  )
}

export default function GrupoResumenPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const [grupo, setGrupo] = useState<GrupoResumen | null>(null)
  const [parrafos, setParrafos] = useState<Parrafo[]>([])
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [escribiendo, setEscribiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)
  const [estudio, setEstudio] = useState<Ajustes | null>(null)
  const [cambiado, setCambiado] = useState(false)
  // Nombre, color e icono del grupo mientras se editan.
  const [renombrando, setRenombrando] = useState<{ name: string; color: string | null; icon: string | null } | null>(null)
  const [max, setMax] = useState(300)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [orden, setOrden] = useState<OrdenGrupo>('documento')
  const [plegados, setPlegados] = useState<Set<string>>(() => new Set())
  // Selección múltiple (deck_items). Se mantiene al cambiar los filtros: se puede ir sumando.
  const [seleccion, setSeleccion] = useState<Set<number>>(() => new Set())
  const [dialogo, setDialogo] = useState<'mover' | 'copiar' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await cargarGrupo(id)
      setGrupo(r.grupo)
      setParrafos(r.parrafos)
      setMax(r.max)
      // Lo seleccionado que ya no está (borrado, movido) deja de estarlo.
      const hay = new Set(r.parrafos.map((p) => p.itemId))
      setSeleccion((s) => ([...s].every((x) => hay.has(x)) ? s : new Set([...s].filter((x) => hay.has(x)))))
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el grupo')
      setEstado('error')
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ?estudiar=1: los ajustes de la sesión, en cuanto haya párrafos (leído de window.location: sin Suspense).
  useEffect(() => {
    if (estado !== 'listo') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('estudiar') === '1' && parrafos.length) {
      setAjustesAbiertos(true)
      router.replace(`/resumenes/${id}`, { scroll: false })
    }
  }, [estado, parrafos.length, id, router])

  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio', trail: [{ label: 'Resúmenes activos', href: '/resumenes' }], current: grupo?.name })
    return () => setBackAction(null)
  }, [setBackAction, grupo?.name])

  // Los avisos de lo que ha ido bien se van solos; los errores se quedan hasta cerrarlos.
  useEffect(() => {
    if (!aviso?.ok) return
    const t = window.setTimeout(() => setAviso(null), 8000)
    return () => window.clearTimeout(t)
  }, [aviso])

  const temas = useMemo(() => [...new Set(parrafos.map(temaDe))], [parrafos])
  const pendientes = parrafos.filter((p) => p.due).length
  const huecos = parrafos.reduce((n, p) => n + p.huecos.length, 0)

  // Filtrar y ordenar con el valor diferido: escribir en el buscador no espera a repintar 300 tarjetas.
  const filtrosDiferidos = useDeferredValue(filtros)
  const visibles = useMemo(() => ordenarParrafos(filtrarParrafos(parrafos, filtrosDiferidos), orden), [parrafos, filtrosDiferidos, orden])
  const terminosTema = useMemo(
    () => (filtrosDiferidos.soloHuecos ? SIN_TERMINOS : terminosDe(filtrosDiferidos.busqueda)),
    [filtrosDiferidos.busqueda, filtrosDiferidos.soloHuecos],
  )
  const secciones = useMemo(() => (orden === 'documento' ? agruparPorTema(visibles) : null), [orden, visibles])
  const totalPorTema = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of parrafos) m.set(temaDe(p), (m.get(temaDe(p)) ?? 0) + 1)
    return m
  }, [parrafos])
  const conteos = useMemo<ConteosGrupo>(() => {
    const c: ConteosGrupo = { estados: { new: 0, failed: 0, learning: 0, mastered: 0 }, niveles: { 1: 0, 2: 0, 3: 0, 4: 0 }, toca: 0, conFallados: 0 }
    for (const p of parrafos) {
      c.estados[p.status ?? 'new']++
      for (const n of new Set(p.huecos.map((h) => h.n))) c.niveles[n]++
      if (tocaRepasar(p)) c.toca++
      if (p.huecosFallados?.length) c.conFallados++
    }
    return c
  }, [parrafos])
  const idsVisibles = useMemo(() => visibles.map((p) => p.itemId), [visibles])
  const nVisiblesSel = useMemo(() => idsVisibles.filter((x) => seleccion.has(x)).length, [idsVisibles, seleccion])
  const todoPlegado = secciones ? secciones.length > 0 && secciones.every(([t]) => plegados.has(t)) : null

  const alternar = useCallback((itemId: number) => {
    setSeleccion((s) => {
      const n = new Set(s)
      if (n.has(itemId)) n.delete(itemId)
      else n.add(itemId)
      return n
    })
  }, [])
  const alternarIds = useCallback((ids: number[]) => setSeleccion((s) => alternarVarios(s, ids)), [])
  const seleccionarVisibles = useCallback(() => setSeleccion((s) => alternarVarios(s, idsVisibles)), [idsVisibles])
  const plegarTodo = useCallback((plegar: boolean) => setPlegados(plegar ? new Set(temas) : new Set()), [temas])
  const plegar = (t: string) =>
    setPlegados((s) => {
      const n = new Set(s)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })

  const borrarUno = useCallback(
    async (p: Parrafo) => {
      if (!window.confirm('¿Borrar este párrafo? Queda 24 horas en la papelera.')) return
      try {
        await quitarParrafo(id, p.itemId)
        void cargar()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo borrar')
      }
    },
    [id, cargar],
  )

  /** Una acción en bloque sobre lo seleccionado. Devuelve el error, o null si ha ido bien (y entonces vacía la selección y recarga). */
  const enBloque = async (cuerpo: CuerpoBloque, nombreDestino = ''): Promise<string | null> => {
    setOcupado(true)
    try {
      const r = await accionBloque(id, cuerpo)
      const texto =
        r.accion === 'tema' && cuerpo.accion === 'tema'
          ? mensajeBloque({ ...r, tema: cuerpo.tema })
          : r.accion === 'mover' || r.accion === 'copiar'
            ? mensajeBloque({ ...r, destino: { name: r.destino.name || nombreDestino } })
            : mensajeBloque(r)
      setAviso({ ok: true, texto })
      setSeleccion(new Set())
      await cargar()
      return null
    } catch (e) {
      return mensajeErrorBloque(e)
    } finally {
      setOcupado(false)
    }
  }

  const aDestino = async (d: Destino): Promise<FalloDestino> => {
    if (!dialogo) return null
    let destino = d.tipo === 'existente' ? { id: d.id, name: d.name } : null
    let creado: GrupoResumen | undefined
    if (d.tipo === 'nuevo') {
      try {
        creado = await crearGrupo(d.name)
        destino = { id: creado.id, name: creado.name }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'No se pudo crear el grupo' }
      }
    }
    if (!destino) return null
    const err = await enBloque({ accion: dialogo, itemIds: [...seleccion], destino: destino.id }, destino.name)
    if (err) return creado ? { error: `${err} · El grupo «${creado.name}» se ha creado, pero está vacío.`, creado } : { error: err }
    setDialogo(null)
    return null
  }

  const pintar = (p: Parrafo, mostrarTema: boolean) =>
    editando === p.id ? (
      <EditorParrafo
        key={p.id}
        inicial={{ texto: p.texto, huecos: p.huecos, tema: p.tema ?? '' }}
        temas={temas.filter(Boolean)}
        guardando={guardando}
        onCancelar={() => setEditando(null)}
        onGuardar={async (x) => {
          setGuardando(true)
          setError(null)
          try {
            await editarParrafo(p.id, { texto: x.texto, huecos: x.huecos, tema: x.tema || null })
            setEditando(null)
            void cargar()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
          } finally {
            setGuardando(false)
          }
        }}
      />
    ) : (
      <TarjetaParrafoGrupo
        key={p.id}
        p={p}
        seleccionado={seleccion.has(p.itemId)}
        onAlternar={alternar}
        onEditar={setEditando}
        onBorrar={borrarUno}
        mostrarTema={mostrarTema}
        mostrarVence={orden === 'vencer'}
        terminos={mostrarTema ? terminosTema : SIN_TERMINOS}
      />
    )

  const empezar = (a: Ajustes) => {
    guardarAjustes(id, a)
    setAjustesAbiertos(false)
    setEstudio(a)
  }

  if (estudio) {
    return (
      <div className="relative min-h-screen bg-[#FAF7F4]">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-8">
          <h1 className="text-2xl font-black text-[#2C3E50]">{grupo?.name}</h1>
          <EstudioResumen
            grupoId={id}
            ajustes={aPeticion(estudio, temas)}
            vista={{ escribir: estudio.escribir, anchoFijo: estudio.anchoFijo }}
            temas={temas.filter(Boolean)}
            onCambio={() => setCambiado(true)}
            onSalir={() => {
              setEstudio(null)
              if (cambiado) void cargar()
              setCambiado(false)
            }}
          />
        </main>
      </div>
    )
  }

  const abrirEdicionGrupo = () => grupo && setRenombrando({ name: grupo.name, color: grupo.color ?? null, icon: grupo.icon ?? null })

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)' }}
      />
      <main className={`relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 ${seleccion.size || aviso ? 'pb-40' : ''}`}>
        {estado === 'error' ? (
          <StickerCard className="p-6 text-center">
            <p className="font-bold text-[#B04A5E]">{error}</p>
            <button type="button" onClick={() => router.push('/resumenes')} className="mt-3 text-sm font-bold underline">
              Volver a los grupos
            </button>
          </StickerCard>
        ) : !grupo ? (
          <p className="py-10 text-center text-sm">Cargando…</p>
        ) : (
          <>
            <Hero
              badge="Resumen activo"
              badgeIcon="text_snippet"
              title={
                <span className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={abrirEdicionGrupo}
                    aria-label="Cambiar el nombre, el color o el icono"
                    title="Cambiar el nombre, el color o el icono"
                    className="shrink-0 transition-transform hover:-translate-y-0.5"
                  >
                    <BaldosaGrupo color={grupo.color} icon={grupo.icon} tam="lg" />
                  </button>
                  <span className="min-w-0 truncate">{grupo.name}</span>
                </span>
              }
              actions={
                <>
                  <StickerButton icon="play_arrow" onClick={() => setAjustesAbiertos(true)} disabled={!parrafos.length}>
                    Estudiar
                  </StickerButton>
                  <GhostButton icon="edit_note" onClick={() => setEscribiendo(true)}>
                    Escribir un párrafo
                  </GhostButton>
                  <GhostButton icon="edit" onClick={abrirEdicionGrupo}>
                    Renombrar
                  </GhostButton>
                  <GhostButton
                    icon="delete"
                    onClick={async () => {
                      if (!window.confirm(`¿Borrar el grupo «${grupo.name}»? Queda 24 horas en la papelera.`)) return
                      try {
                        await borrarGrupo(id)
                        router.push('/resumenes')
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'No se pudo borrar')
                      }
                    }}
                  >
                    Borrar grupo
                  </GhostButton>
                </>
              }
            >
              <div className="mt-4 flex flex-wrap gap-2">
                <StatChip value={parrafos.length} label="párrafos" />
                <StatChip value={huecos} label="huecos" color="#3F7EA6" />
                <StatChip value={pendientes} label="por repasar" color="#B07A1E" />
              </div>
            </Hero>

            {renombrando !== null && (
              <StickerCard className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center gap-3" data-editar-grupo>
                  <BaldosaGrupo color={renombrando.color} icon={renombrando.icon} />
                  <input
                    autoFocus
                    value={renombrando.name}
                    onChange={(e) => setRenombrando({ ...renombrando, name: e.target.value.slice(0, 80) })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenombrando(null)
                    }}
                    aria-label="Nombre del grupo"
                    className="min-w-0 flex-1 rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
                  />
                </div>
                <ColorIconoGrupo color={renombrando.color} icon={renombrando.icon} onChange={(v) => setRenombrando({ ...renombrando, ...v })} />
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setRenombrando(null)} className="text-sm font-bold">
                    Cancelar
                  </button>
                  <StickerButton
                    icon="check"
                    disabled={renombrando.name.trim().length < 3}
                    onClick={async () => {
                      const name = renombrando.name.trim()
                      // Solo lo que ha cambiado (un grupo sin color sigue sin él si no se toca).
                      const cambio = {
                        ...(name !== grupo.name ? { name } : {}),
                        ...(renombrando.color !== (grupo.color ?? null) ? { color: renombrando.color } : {}),
                        ...(renombrando.icon !== (grupo.icon ?? null) ? { icon: renombrando.icon } : {}),
                      }
                      try {
                        if (Object.keys(cambio).length) await editarGrupo(id, cambio)
                        setRenombrando(null)
                        void cargar()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'No se pudo guardar el grupo')
                      }
                    }}
                  >
                    Guardar
                  </StickerButton>
                </div>
              </StickerCard>
            )}

            {error && <p className="rounded-2xl bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E]">{error}</p>}

            {escribiendo && (
              <EditorParrafo
                inicial={{ texto: '', huecos: [], tema: '' }}
                temas={temas.filter(Boolean)}
                guardando={guardando}
                textoBoton="Añadir al grupo"
                onCancelar={() => setEscribiendo(false)}
                onGuardar={async (x) => {
                  setGuardando(true)
                  setError(null)
                  try {
                    const r = await anadirParrafos(id, [{ texto: x.texto, huecos: x.huecos, tema: x.tema || null }], false)
                    if (!r.creados) setError('Ese párrafo ya está en el grupo.')
                    setEscribiendo(false)
                    void cargar()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo añadir')
                  } finally {
                    setGuardando(false)
                  }
                }}
              />
            )}

            {parrafos.length === 0 && !escribiendo ? (
              <StickerCard className="p-8 text-center">
                <p className="text-lg font-extrabold text-[#2C3E50]">Este grupo está vacío</p>
                <p className="mt-1 text-sm">Escribe un párrafo y toca las palabras que quieres tapar al estudiar.</p>
              </StickerCard>
            ) : null}

            {parrafos.length > 0 && (
              <FiltrosGrupo
                filtros={filtros}
                onFiltros={setFiltros}
                orden={orden}
                onOrden={setOrden}
                conteos={conteos}
                total={parrafos.length}
                visibles={visibles.length}
                todosVisiblesSeleccionados={visibles.length > 0 && nVisiblesSel === visibles.length}
                onSeleccionarVisibles={seleccionarVisibles}
                plegado={todoPlegado}
                onPlegarTodo={plegarTodo}
              />
            )}

            {parrafos.length > 0 && visibles.length === 0 && (
              <p className="py-6 text-center text-sm">
                Ningún párrafo coincide con los filtros.{' '}
                <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)} className="font-bold underline hover:text-[#2C3E50]">
                  Quitar filtros
                </button>
              </p>
            )}

            {secciones
              ? secciones.map(([tema, lista]) => {
                  const plegado = plegados.has(tema)
                  const total = totalPorTema.get(tema) ?? lista.length
                  return (
                    <section key={tema || '-'} className="flex flex-col gap-2" data-tema={tema}>
                      <div className="flex items-center gap-2">
                        <CasillaTema ids={lista.map((p) => p.itemId)} seleccion={seleccion} onAlternar={alternarIds} tema={tema} />
                        <button type="button" onClick={() => plegar(tema)} aria-expanded={!plegado} className="flex min-w-0 flex-1 items-center gap-1 text-left">
                          <span className="material-symbols-outlined text-[18px] text-[#7D8A96]" aria-hidden>
                            {plegado ? 'chevron_right' : 'expand_more'}
                          </span>
                          <h2 className="min-w-0 truncate text-sm font-black uppercase tracking-wide text-[#2C3E50]">
                            {tema ? <Resaltado texto={tema} terminos={terminosTema} /> : 'Sin tema'}
                          </h2>
                          <span className="shrink-0 text-xs font-bold text-[#7D8A96]">{lista.length === total ? total : `${lista.length} de ${total}`}</span>
                        </button>
                      </div>
                      {!plegado && <div className="flex flex-col gap-2 pl-6">{lista.map((p) => pintar(p, false))}</div>}
                    </section>
                  )
                })
              : visibles.length > 0 && <div className="flex flex-col gap-2">{visibles.map((p) => pintar(p, true))}</div>}
          </>
        )}
      </main>

      {(seleccion.size > 0 || aviso) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2">
            {aviso && (
              <div
                role={aviso.ok ? 'status' : 'alert'}
                className="flex items-start gap-2 rounded-2xl border-2 border-[#2c3e50] px-4 py-2.5 text-sm font-bold"
                style={{ background: aviso.ok ? '#EEF5EC' : '#FAEAED', color: aviso.ok ? '#3F6A3B' : '#B04A5E', boxShadow: '3px 3px 0 0 #2c3e50' }}
                data-aviso-bloque
              >
                <p className="min-w-0 flex-1">{aviso.texto}</p>
                <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar el aviso" className="shrink-0 opacity-70 hover:opacity-100">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}
            {seleccion.size > 0 && (
              <BarraBloque
                n={seleccion.size}
                ocultos={seleccion.size - nVisiblesSel}
                temas={temas.filter(Boolean)}
                ocupado={ocupado}
                onMover={() => setDialogo('mover')}
                onCopiar={() => setDialogo('copiar')}
                onCambiarTema={async (tema) => {
                  const err = await enBloque({ accion: 'tema', itemIds: [...seleccion], tema })
                  if (err) setAviso({ ok: false, texto: err })
                  return !err
                }}
                onBorrar={async () => {
                  const n = seleccion.size
                  if (!window.confirm(`¿Borrar ${n === 1 ? 'el párrafo seleccionado' : `los ${n} párrafos seleccionados`}? Quedan 24 horas en la papelera.`)) return
                  const err = await enBloque({ accion: 'borrar', itemIds: [...seleccion] })
                  if (err) setAviso({ ok: false, texto: err })
                }}
                onCerrar={() => setSeleccion(new Set())}
              />
            )}
          </div>
        </div>
      )}

      {dialogo && <DialogoDestino accion={dialogo} n={seleccion.size} grupoActual={id} max={max} onCerrar={() => setDialogo(null)} onConfirmar={aDestino} />}

      {ajustesAbiertos && (
        <AjustesEstudio parrafos={parrafos} inicial={leerAjustes(id)} onCerrar={() => setAjustesAbiertos(false)} onEmpezar={empezar} />
      )}
    </div>
  )
}
