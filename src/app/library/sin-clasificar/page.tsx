'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import MoverACarpeta from '@/components/carpetas/MoverACarpeta'
import MoverVarios from '@/components/carpetas/MoverVarios'
import AceptarSugerencias from '@/components/carpetas/AceptarSugerencias'
import { moverACarpeta } from '@/lib/carpetas/api'
import { nombreCarpeta, type Carpeta } from '@/lib/carpetas/sugerir'
import { cuentaDe, rutaCarpeta, textoCuenta, type ElementoMaterial } from '@/lib/carpetas/biblioteca'
import { useScrollRecordado } from '@/hooks/useMemoriaDePestana'
import { claveElemento as clave, useSinClasificar } from '@/components/library/biblioteca/useSinClasificar'
import { FilaElemento, Hero, INK, SectionLabel, StickerButton, StickerCard, TEXTURA_LOMOS } from '@/components/library/biblioteca/ui'
import { PildorasFiltro, type OpcionFiltro } from '@/components/ui/PildorasFiltro'
import { Esqueleto, NumeroAnimado, PaginaConMovimiento, RejillaAnimada, SALIDA, TRANSICION, entrada } from '@/components/ui/movimiento'

// «Sin clasificar» (§6): lo que no tiene carpeta. Cada elemento tiene «Mover a…» y, si el emparejador ve
// a qué tema se parece (título, temas de sus tarjetas o párrafos, documento de origen), un atajo de un
// clic «¿A Reumatología › Lupus?». Selección múltiple para mover varios a la vez. NUNCA se mueve nada solo.
// Vistas: todo, solo lo que tiene sugerencia (agrupado por carpeta) o lo que parece de una asignatura; en
// las dos últimas, «Aceptar las sugerencias» mueve cada cosa a la suya tras enseñar adónde va.
// Movimiento: lo que se mueve sale hacia la derecha y lo de debajo sube a su hueco; el aviso y la barra
// de selección entran y salen. Al volver, la lista está como se dejó (memoria de pestaña) y se refresca.

const mismas = (a: Carpeta, b: Carpeta) => a.subjectId === b.subjectId && a.topicId === b.topicId

type Vista = 'todo' | 'sugeridas' | 'asignatura'

export default function SinClasificarPage() {
  // La vista puede venir en la URL (?ver=sugeridas o ?asignatura=2: desde la portada o una asignatura).
  // useSearchParams pide un Suspense porque la ruta se prerenderiza; mientras, la misma pantalla con la
  // vista por defecto (es lo que queda en el HTML estático). Al navegar dentro de la app llegan ya.
  return (
    <Suspense fallback={<SinClasificar />}>
      <SinClasificarConUrl />
    </Suspense>
  )
}

function SinClasificarConUrl() {
  const params = useSearchParams()
  return <SinClasificar ver={params.get('ver')} asignatura={Number(params.get('asignatura')) || null} />
}

function SinClasificar({ ver = null, asignatura = null }: { ver?: string | null; asignatura?: number | null }) {
  const { setBackAction } = useHeaderUI()
  const { carga, arbol, elementos, sugerencias } = useSinClasificar()
  const [vista, setVista] = useState<Vista>(() => (asignatura ? 'asignatura' : ver === 'sugeridas' ? 'sugeridas' : 'todo'))
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [moverUno, setMoverUno] = useState<ElementoMaterial | null>(null)
  const [moverVarios, setMoverVarios] = useState(false)
  const [aceptarVista, setAceptarVista] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; carpeta: Carpeta | null; n: number } | null>(null)
  const casillaTodas = useRef<HTMLInputElement>(null)

  const errorCarga = !carga.datos && carga.error ? (carga.error instanceof Error ? carga.error.message : 'No se pudo cargar') : null

  useEffect(() => {
    setBackAction({ label: 'Biblioteca', href: '/library', current: 'Sin clasificar' })
    return () => setBackAction(null)
  }, [setBackAction])

  const raizScroll = useScrollRecordado('biblioteca:sin-clasificar', elementos !== null)

  const lista = useMemo(() => elementos ?? [], [elementos])
  const asigFiltro = asignatura && arbol ? (arbol.find((a) => a.id === asignatura) ?? null) : null
  const deAsignatura = useMemo(
    () => (asignatura ? lista.filter((e) => sugerencias.get(clave(e))?.subjectId === asignatura).length : 0),
    [lista, sugerencias, asignatura],
  )

  // Lo que se ve: todo, o lo que tiene sugerencia (de cualquier asignatura o de una), agrupado por carpeta.
  const visibles = useMemo(() => {
    if (vista === 'todo') return lista
    const con = lista.filter((e) => {
      const s = sugerencias.get(clave(e))
      return !!s && (vista === 'sugeridas' || s.subjectId === asignatura)
    })
    const nombre = (e: ElementoMaterial) => nombreCarpeta(arbol, sugerencias.get(clave(e))!, { corto: true })
    return [...con].sort((a, b) => nombre(a).localeCompare(nombre(b), 'es'))
  }, [vista, lista, sugerencias, asignatura, arbol])

  const elegidos = lista.filter((e) => seleccion.has(clave(e)))
  const todas = visibles.length > 0 && visibles.every((e) => seleccion.has(clave(e)))
  useEffect(() => {
    if (casillaTodas.current) casillaTodas.current.indeterminate = elegidos.length > 0 && !todas
  }, [elegidos.length, todas])

  // Si todos los seleccionados comparten sugerencia, el diálogo la ofrece como atajo.
  const sugerenciaComun = useMemo(() => {
    const ss = elegidos.map((e) => sugerencias.get(clave(e)) ?? null)
    return ss.length > 0 && ss.every((s) => s && ss[0] && mismas(s, ss[0])) ? ss[0] : null
  }, [elegidos, sugerencias])

  const opciones: OpcionFiltro<Vista>[] = [
    { valor: 'todo', etiqueta: 'Todo', cuenta: elementos ? lista.length : null },
    { valor: 'sugeridas', etiqueta: 'Con sugerencia', cuenta: elementos ? sugerencias.size : null },
    ...(asignatura
      ? [{ valor: 'asignatura' as const, etiqueta: asigFiltro?.nombreCorto ?? 'Asignatura', cuenta: elementos ? deAsignatura : null }]
      : []),
  ]
  const cambiarVista = (v: Vista) => {
    setVista(v)
    // La selección es de lo que se ve: al cambiar de vista se empieza de cero.
    setSeleccion(new Set())
  }

  const quitar = (claves: string[], carpeta: Carpeta, { avisar = true } = {}) => {
    const fuera = new Set(claves)
    // En la pantalla y en la memoria: al volver, lo movido ya no está.
    carga.mutar(([a, es]) => [a, es.filter((e) => !fuera.has(clave(e)))])
    setSeleccion((prev) => new Set([...prev].filter((k) => !fuera.has(k))))
    if (!avisar) return
    const n = claves.length
    setAviso((prev) => ({ texto: `${n === 1 ? 'Movido' : `${n} movidos`} a ${nombreCarpeta(arbol, carpeta, { corto: true })}`, carpeta, n: (prev?.n ?? 0) + 1 }))
  }

  const aceptarSugerencia = async (e: ElementoMaterial, c: Carpeta) => {
    setOcupado(clave(e))
    setError(null)
    try {
      await moverACarpeta(e.tipo, [e.id], c, 'sugerencia')
      quitar([clave(e)], c)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover')
    } finally {
      setOcupado(null)
    }
  }

  const alternar = (k: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (s.has(k)) s.delete(k)
      else s.add(k)
      return s
    })

  const cuenta = cuentaDe(lista)
  const avisoError = error ?? errorCarga

  return (
    <PaginaConMovimiento animarEntrada={!carga.deMemoria}>
      <main
        ref={raizScroll}
        className={`min-h-screen overflow-x-clip bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] transition-[padding] duration-300 sm:px-6 [@media(max-height:850px)]:py-5 ${elegidos.length ? 'pb-28' : ''}`}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Hero
            badge="Biblioteca"
            badgeIcon="inbox"
            title="Sin clasificar"
            subtitle={
              elementos === null
                ? 'Buscando lo que no tiene carpeta…'
                : lista.length
                  ? `${textoCuenta(cuenta)}. Muévelos a su asignatura o tema: allí se ven junto a sus preguntas MIR.`
                  : 'Nada por ordenar: todo tu material está en su carpeta.'
            }
            backdrop={<div className="pointer-events-none absolute inset-0" style={TEXTURA_LOMOS} />}
          />

          <AnimatePresence initial={false} mode="popLayout">
            {aviso ? (
              // La key cambia con cada movimiento: el aviso nuevo entra encima del anterior en vez de cambiar de golpe.
              <motion.div
                key={`aviso-${aviso.n}`}
                layout="position"
                role="status"
                className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#8BA888] bg-[#EAF1E9] px-4 py-2.5 text-sm font-bold text-[#3F5E3C]"
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: SALIDA }}
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              >
                <span className="inline-flex" aria-hidden>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </span>
                <span className="min-w-0 flex-1">{aviso.texto}</span>
                {aviso.carpeta && aviso.carpeta.subjectId !== null ? (
                  <Link href={rutaCarpeta(aviso.carpeta.subjectId, aviso.carpeta.topicId)} className="font-black underline-offset-2 hover:underline">
                    Ver la carpeta
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAviso(null)}
                  aria-label="Cerrar aviso"
                  className="inline-flex rounded-full text-[#5C7A59] transition-[color,rotate] duration-200 hover:rotate-90 hover:text-[#2C3E50] motion-reduce:transition-none"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {avisoError ? (
              <motion.p
                key="error"
                role="alert"
                className="text-sm font-bold text-[#B04A5E]"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={TRANSICION}
              >
                {avisoError}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="popLayout">
            {elementos === null && !errorCarga ? (
              <motion.div key="cargando" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                <ListaEsqueleto />
              </motion.div>
            ) : lista.length > 0 ? (
              <motion.div key="lista" {...entrada(0.06)} exit={{ opacity: 0, transition: SALIDA }}>
                <StickerCard as="section" className="flex flex-col gap-3 p-4 sm:p-5" depth={5}>
                  <PildorasFiltro opciones={opciones} valor={vista} onElegir={cambiarVista} idPildora="sin-clasificar-vista" etiqueta="Qué enseñar" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-extrabold text-[#2C3E50]">
                      <input
                        ref={casillaTodas}
                        type="checkbox"
                        checked={todas}
                        disabled={visibles.length === 0}
                        onChange={() => setSeleccion(todas ? new Set() : new Set(visibles.map(clave)))}
                        aria-label="Seleccionar todo lo que se ve"
                      />
                      {elegidos.length ? `${elegidos.length} ${elegidos.length === 1 ? 'seleccionado' : 'seleccionados'}` : 'Seleccionar todo'}
                    </label>
                    {/* En las vistas de sugerencias: moverlo todo a lo sugerido, tras enseñar adónde va cada grupo. */}
                    <AnimatePresence initial={false}>
                      {vista !== 'todo' && visibles.length > 0 && arbol ? (
                        <motion.button
                          key="aceptar"
                          type="button"
                          onClick={() => setAceptarVista(true)}
                          className="group/acep inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2c3e50] bg-[#E8A598] px-3 py-1.5 text-sm font-black text-white shadow-[3px_3px_0_0_#2c3e50] transition-[translate,box-shadow] duration-150 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_#2c3e50] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#2c3e50] motion-reduce:transition-none"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                        >
                          <span
                            className="inline-flex transition-[rotate,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/acep:rotate-12 group-hover/acep:scale-110 motion-reduce:transition-none"
                            aria-hidden
                          >
                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                          </span>
                          {visibles.length === 1 ? (
                            'Aceptar la sugerencia'
                          ) : (
                            <>
                              Aceptar las <NumeroAnimado valor={visibles.length} /> sugerencias
                            </>
                          )}
                        </motion.button>
                      ) : null}
                    </AnimatePresence>
                  </div>
                  <SectionLabel>
                    <NumeroAnimado valor={visibles.length} />{' '}
                    {vista === 'todo' ? 'sin carpeta' : vista === 'sugeridas' ? 'con sugerencia' : `para ${asigFiltro?.nombreCorto ?? 'esta asignatura'}`}
                  </SectionLabel>
                  <AnimatePresence initial={false}>
                    {visibles.length === 0 ? (
                      <motion.div
                        key="vista-vacia"
                        className="flex flex-col items-center gap-2 py-6 text-center"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { ...TRANSICION, delay: 0.1 } }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-sm font-bold text-[#7D8A96]">
                          {vista === 'asignatura'
                            ? `Ya no queda nada que parezca de ${asigFiltro?.nombreCorto ?? 'esta asignatura'}.`
                            : 'Ya no queda nada con sugerencia.'}
                        </p>
                        <button type="button" onClick={() => cambiarVista('todo')} className="text-sm font-black text-[#C97D6F] hover:underline">
                          Ver todo lo sin clasificar
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <RejillaAnimada as="ul" className="flex flex-col gap-2" aria-label="Material sin carpeta">
                    {visibles.map((e, i) => {
                      const k = clave(e)
                      const s = sugerencias.get(k)
                      return (
                        <FilaElemento
                          key={k}
                          e={e}
                          indice={i}
                          inicio={<input type="checkbox" checked={seleccion.has(k)} onChange={() => alternar(k)} aria-label={`Seleccionar «${e.titulo}»`} />}
                          extra={
                            s && arbol ? (
                              <button
                                type="button"
                                disabled={ocupado !== null}
                                onClick={() => void aceptarSugerencia(e, s)}
                                className="group/sug mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[#E8A598]/60 bg-[#FCEFEC] px-2.5 py-0.5 text-[11px] font-extrabold text-[#C97D6F] transition-[border-color,translate] duration-150 hover:-translate-y-px hover:border-[#E8A598] active:translate-y-px disabled:opacity-50 motion-reduce:transition-none"
                                title="Moverlo ahí con un clic"
                              >
                                <span
                                  className="inline-flex transition-[rotate,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/sug:rotate-12 group-hover/sug:scale-110 motion-reduce:transition-none"
                                  aria-hidden
                                >
                                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                </span>
                                {ocupado === k ? 'Moviendo…' : `¿A ${nombreCarpeta(arbol, s, { corto: true })}?`}
                              </button>
                            ) : null
                          }
                          acciones={
                            <button
                              type="button"
                              onClick={() => setMoverUno(e)}
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-extrabold text-[#7D8A96] transition-colors hover:bg-[#FAF7F4] hover:text-[#2C3E50] active:bg-[#F5F1EE]"
                            >
                              <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                              Mover a…
                            </button>
                          }
                        />
                      )
                    })}
                  </RejillaAnimada>
                </StickerCard>
              </motion.div>
            ) : elementos !== null ? (
              <motion.div
                key="vacia"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { ...TRANSICION, delay: 0.1 } }}
                exit={{ opacity: 0 }}
              >
                <StickerCard className="flex flex-col items-center gap-2 p-8 text-center" depth={4}>
                  <span className="inline-flex text-[#8BA888]" aria-hidden>
                    <span className="material-symbols-outlined text-[40px]">task_alt</span>
                  </span>
                  <p className="text-sm font-bold text-[#2C3E50]">Todo en su carpeta.</p>
                  <Link href="/library" className="text-sm font-black text-[#C97D6F] hover:underline">
                    Volver a la Biblioteca
                  </Link>
                </StickerCard>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Con algo seleccionado, una barra flotante abajo: la cabecera global es «sticky» (y alta en móvil),
            así que una barra fija arriba quedaría tapada. Sube al seleccionar y baja al soltar. */}
        <AnimatePresence>
          {elegidos.length ? (
            <motion.div
              key="barra"
              className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            >
              <div
                className="flex w-full max-w-md items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-white py-2 pr-2 pl-4"
                style={{ boxShadow: `4px 4px 0 0 ${INK}` }}
                role="region"
                aria-label="Selección"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-black text-[#2C3E50]">
                  <NumeroAnimado valor={elegidos.length} /> {elegidos.length === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
                <button type="button" onClick={() => setSeleccion(new Set())} className="shrink-0 text-xs font-extrabold text-[#7D8A96] transition-colors hover:text-[#2C3E50]">
                  Quitar
                </button>
                <StickerButton icon="drive_file_move" disabled={!arbol} onClick={() => setMoverVarios(true)} className="!px-4 !py-2">
                  Mover a…
                </StickerButton>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {moverUno ? (
          <MoverACarpeta
            tipo={moverUno.tipo}
            id={moverUno.id}
            titulo={moverUno.titulo}
            actual={moverUno.carpeta}
            onClose={() => setMoverUno(null)}
            onMovido={(c) => quitar([clave(moverUno)], c)}
          />
        ) : null}
        <AnimatePresence>
          {aceptarVista && arbol ? (
            <AceptarSugerencias
              key="aceptar"
              elementos={visibles}
              sugerencias={sugerencias}
              clave={clave}
              arbol={arbol}
              onClose={() => setAceptarVista(false)}
              onMovidos={(claves, c) => quitar(claves, c, { avisar: false })}
              onTerminado={(n, carpetas) => {
                if (!n) return
                // A una sola carpeta: se nombra y se enlaza, como al mover uno; a varias, solo cuántas.
                const una = carpetas.length === 1 ? carpetas[0] : null
                const destino = una ? nombreCarpeta(arbol, una, { corto: true }) : `${carpetas.length} carpetas`
                setAviso((prev) => ({
                  texto: `${n === 1 ? 'Movido' : `${n} movidos`} a ${destino}`,
                  carpeta: una,
                  n: (prev?.n ?? 0) + 1,
                }))
              }}
            />
          ) : null}
        </AnimatePresence>
        {moverVarios ? (
          <MoverVarios
            seleccion={elegidos.map(({ tipo, id }) => ({ tipo, id }))}
            sugerida={sugerenciaComun}
            onClose={() => setMoverVarios(false)}
            onMovidos={(ids, c) => {
              const movidos = new Set(ids)
              quitar(elegidos.filter((e) => movidos.has(e.id)).map(clave), c)
            }}
          />
        ) : null}
      </main>
    </PaginaConMovimiento>
  )
}

/** La lista mientras llega: la tarjeta y unas filas en hueso, con la altura de las de verdad. */
function ListaEsqueleto() {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-[#EAE4E2] bg-white/70 p-4 sm:p-5" aria-busy>
      <p className="sr-only">Cargando…</p>
      <Esqueleto className="h-4 w-32" />
      <Esqueleto className="h-3 w-24" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border-2 border-[#EAE4E2] bg-white px-3 py-2.5" aria-hidden>
          <Esqueleto className="h-9 w-9 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Esqueleto className="h-3.5 w-1/2" />
            <Esqueleto className="h-3 w-1/3" />
          </div>
          <Esqueleto className="hidden h-8 w-36 rounded-xl sm:block" />
        </div>
      ))}
    </div>
  )
}
