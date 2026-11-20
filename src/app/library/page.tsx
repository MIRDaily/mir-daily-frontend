'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cargarArbol, cargarRecuento, useArbolCarpetas } from '@/lib/carpetas/api'
import { normalizar, type AsignaturaCatalogo } from '@/lib/carpetas/sugerir'
import { tarjetasAsignaturas, textoCuenta } from '@/lib/carpetas/biblioteca'
import { guiaDeAsignatura } from '@/lib/studyGuides'
import { CATEGORY_LABEL, type SubjectCategory } from '@/lib/subjectVisuals'
import { useCargaRecordada, useEstadoRecordado, useScrollRecordado } from '@/hooks/useMemoriaDePestana'
import { useAciertoAsignaturas } from '@/components/library/biblioteca/useDatosAsignatura'
import {
  CifrasMaterial,
  CifrasPreguntas,
  Estado,
  Hero,
  INK,
  SectionLabel,
  Sigla,
  StickerCard,
  TEXTURA_LOMOS,
  visualAsignatura,
} from '@/components/library/biblioteca/ui'
import {
  AlturaAnimada,
  EMPUJE_HOVER,
  GIRO_HOVER,
  ItemAnimado,
  NumeroAnimado,
  PEGATINA_4,
  PEGATINA_5,
  PaginaConMovimiento,
  RejillaAnimada,
  Resaltado,
  SALIDA,
  TRANSICION,
  entrada,
} from '@/components/ui/movimiento'

// Biblioteca (carpetas del material, fase 2): las asignaturas del catálogo, «Sin clasificar» arriba y, en
// cada asignatura, lo que el usuario tiene archivado. Las preguntas MIR van aparte, con sus analíticas de
// siempre: juntos, pero sin mezclar cifras (D2).
// Al volver (sin recargar) todo está como se dejó: filtro, búsqueda, scroll y datos, sin repetir la entrada.

type Filtro = 'TODAS' | Exclude<SubjectCategory, 'PERSONAL'>
const FILTROS: Filtro[] = ['TODAS', 'MÉDICA', 'QUIRÚRGICA', 'BÁSICA']

/** Huecos mientras llega el catálogo: misma forma que una tarjeta, para que al llegar no salte nada. */
const ESQUELETOS = 8

const mensajeDe = (e: unknown, porDefecto: string) => (e ? (e instanceof Error ? e.message : porDefecto) : null)

export default function LibraryPage() {
  const portada = useCargaRecordada('biblioteca:portada', () => Promise.all([cargarArbol(), cargarRecuento()]))
  // El acierto en preguntas es un añadido: si falla, la Biblioteca se enseña igual.
  const heatmap = useAciertoAsignaturas()
  const [busca, setBusca] = useEstadoRecordado('biblioteca:busca', '')
  const [filtro, setFiltro] = useEstadoRecordado<Filtro>('biblioteca:filtro', 'TODAS')
  const reducir = useReducedMotion()
  const campo = useRef<HTMLInputElement | null>(null)
  const filtrosRef = useRef<HTMLDivElement | null>(null)

  const arbol = portada.datos?.[0] ?? null
  const recuento = portada.datos?.[1] ?? null
  const error = mensajeDe(portada.error, 'No se pudo cargar la Biblioteca')
  const acierto = useMemo(() => new Map((heatmap.datos?.subjects ?? []).map((s) => [s.subjectId, s])), [heatmap.datos])

  const raizScroll = useScrollRecordado('biblioteca', !!arbol)

  // El campo responde al instante; la rejilla (y sus animaciones) va un paso por detrás si hace falta.
  const buscaDiferida = useDeferredValue(busca)
  const q = normalizar(buscaDiferida)

  // Los contadores de los filtros solo dependen del catálogo, que se guarda por pestaña: salen en el primer
  // pintado aunque el recuento del material aún no haya llegado.
  const catalogo = useArbolCarpetas()
  const arbolContado = arbol ?? catalogo

  // Lo que deja la búsqueda, cuántas quedan en cada filtro (para los contadores) y lo que se enseña.
  const { tarjetas, porFiltro } = useMemo(() => {
    const coincide = (a: AsignaturaCatalogo) =>
      !q || [a.nombre, a.nombreCorto, a.subtitulo ?? '', a.sigla ?? ''].some((t) => normalizar(t).includes(q))
    let cuenta: Record<Filtro, number> | null = null
    if (arbolContado) {
      cuenta = { TODAS: 0, MÉDICA: 0, QUIRÚRGICA: 0, BÁSICA: 0 }
      for (const a of arbolContado) {
        if (!coincide(a)) continue
        cuenta.TODAS += 1
        const c = visualAsignatura(a).category
        if (c !== 'PERSONAL') cuenta[c] += 1
      }
    }
    if (!arbol) return { tarjetas: [], porFiltro: cuenta }
    const buscadas = tarjetasAsignaturas(arbol, recuento).filter(({ asignatura: a }) => coincide(a))
    return {
      tarjetas: filtro === 'TODAS' ? buscadas : buscadas.filter((t) => visualAsignatura(t.asignatura).category === filtro),
      porFiltro: cuenta,
    }
  }, [arbol, arbolContado, recuento, q, filtro])

  // En móvil los filtros se desplazan en horizontal: el elegido se trae a la vista. Solo se mueve la tira
  // (scrollIntoView también movería la página y pisaría el scroll recordado); al montar, sin animación.
  const montado = useRef(false)
  useEffect(() => {
    const tira = filtrosRef.current
    const boton = tira?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (tira && boton) {
      const izq = boton.offsetLeft - tira.offsetLeft
      const der = izq + boton.offsetWidth
      const destino = izq < tira.scrollLeft ? izq : der > tira.scrollLeft + tira.clientWidth ? der - tira.clientWidth : null
      if (destino !== null) tira.scrollTo({ left: destino, behavior: montado.current && !reducir ? 'smooth' : 'instant' })
    }
    montado.current = true
  }, [filtro, reducir])

  // Pulsar el filtro activo lo quita (vuelve a «Todas»).
  const elegirFiltro = (f: Filtro) => setFiltro((actual) => (actual === f && f !== 'TODAS' ? 'TODAS' : f))

  const limpiarBusqueda = () => {
    setBusca('')
    campo.current?.focus()
  }

  const sin = recuento?.sinClasificar
  const textoSin = !recuento
    ? 'Contando tu material…'
    : sin && sin.total > 0
      ? `${textoCuenta(sin)} sin carpeta. Muévelos a su asignatura para verlos junto a sus preguntas.`
      : 'Todo tu material está en su carpeta.'

  const cargando = !arbol && !error
  const vacio = !!arbol && tarjetas.length === 0

  return (
    <PaginaConMovimiento animarEntrada={!portada.deMemoria}>
      {/* overflow-x-clip y no -hidden: «hidden» convierte el main en un contenedor con scroll vertical propio, y
          las tarjetas que salen al filtrar (que sobresalen por abajo mientras se desvanecen) le sacaban una barra
          de 15 px que corría todo hacia la izquierda. «clip» recorta igual sin crear contenedor de scroll. */}
      <main ref={raizScroll} className="relative min-h-screen overflow-x-clip bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] antialiased sm:px-6 [@media(max-height:850px)]:py-5">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 [@media(max-height:850px)]:gap-6">
          <Hero
            badge="Biblioteca"
            badgeIcon="local_library"
            title="Tu temario, carpeta a carpeta"
            subtitle="Cada asignatura con tus mapas, flashcards y resúmenes, junto a las preguntas MIR de cada tema."
            backdrop={<div className="pointer-events-none absolute inset-0" style={TEXTURA_LOMOS} />}
          />

          <AnimatePresence initial={false}>
            {error ? (
              <motion.div key="error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={TRANSICION}>
                <StickerCard className="p-6">
                  <Estado error>{error}</Estado>
                </StickerCard>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div {...entrada(0.06)}>
            <Link href="/library/sin-clasificar" className="group block rounded-3xl outline-none">
              <StickerCard
                className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5 ${PEGATINA_5}`}
                style={{ boxShadow: undefined }}
              >
                <span className={`inline-flex shrink-0 ${GIRO_HOVER}`} aria-hidden>
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#2c3e50] bg-[#FCEFEC]"
                    style={{ boxShadow: `3px 3px 0 0 ${INK}` }}
                  >
                    <span className="material-symbols-outlined text-[30px] text-[#C97D6F]">inbox</span>
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black text-[#2C3E50]">
                    Sin clasificar
                    <AnimatePresence initial={false}>
                      {sin ? (
                        <motion.span
                          key="total"
                          className="ml-2 inline-flex items-center rounded-full bg-[#E8A598] px-2.5 py-0.5 align-middle text-sm font-black text-white tabular-nums"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                        >
                          <NumeroAnimado valor={sin.total} />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </h2>
                  <AlturaAnimada>
                    <motion.p
                      key={textoSin}
                      className="text-sm text-[#7D8A96]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {textoSin}
                    </motion.p>
                  </AlturaAnimada>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-sm font-black text-[#C97D6F] sm:inline-flex">
                  Ordenar
                  <span className={EMPUJE_HOVER}>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </span>
                </span>
              </StickerCard>
            </Link>
          </motion.div>

          <motion.section className="flex flex-col gap-4" {...entrada(0.12)}>
            <SectionLabel
              right={
                <AnimatePresence initial={false}>
                  {recuento ? (
                    <motion.span
                      key="total"
                      className="text-[11px] font-bold text-[#7D8A96]/70"
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={TRANSICION}
                    >
                      {recuento.total} en total
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              }
            >
              Asignaturas
            </SectionLabel>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Al enfocar, el campo se despega como una pegatina (borde de tinta y sombra dura). */}
              <div className="group/campo relative flex w-full items-center rounded-2xl border-2 border-[#EAE4E2] bg-white transition-[border-color,box-shadow,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#D9CFC9] focus-within:-translate-x-px focus-within:-translate-y-px focus-within:border-[#2c3e50] focus-within:shadow-[3px_3px_0_0_#2c3e50] focus-within:hover:border-[#2c3e50] motion-reduce:transition-none md:max-w-sm">
                <label className="flex min-w-0 flex-1 cursor-text items-center">
                  <span
                    className="pointer-events-none inline-flex pl-3 text-[#7D8A96] transition-[color,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-focus-within/campo:scale-110 group-focus-within/campo:text-[#2C3E50] motion-reduce:transition-none"
                    aria-hidden
                  >
                    <span className="material-symbols-outlined text-[20px]">search</span>
                  </span>
                  <input
                  ref={campo}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && busca) {
                      e.preventDefault()
                      setBusca('')
                    }
                  }}
                  placeholder="Busca una asignatura…"
                  aria-label="Buscar asignatura"
                  className="min-w-0 flex-1 bg-transparent py-2.5 pr-2 pl-2 text-sm font-semibold text-[#2C3E50] outline-none placeholder:text-[#7D8A96]/70"
                  />
                </label>
                <AnimatePresence initial={false}>
                  {busca ? (
                    <motion.button
                      key="borrar"
                      type="button"
                      onClick={limpiarBusqueda}
                      aria-label="Borrar la búsqueda"
                      className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#7D8A96] transition-colors hover:bg-[#F5F1EE] hover:text-[#2C3E50]"
                      initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                      whileTap={{ scale: 0.85 }}
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </div>
              <motion.div
                ref={filtrosRef}
                layoutScroll
                className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Tipo de asignatura"
              >
                {FILTROS.map((f) => {
                  const activo = filtro === f
                  const n = porFiltro ? porFiltro[f] : null
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => elegirFiltro(f)}
                      aria-pressed={activo}
                      className={`relative shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-extrabold transition-colors duration-200 motion-reduce:transition-none ${
                        activo
                          ? 'border-transparent text-white'
                          : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2C3E50]'
                      }`}
                    >
                      {/* La píldora oscura viaja de un filtro a otro; va por encima del fondo blanco de los demás
                          (z-1) y por debajo de los textos (z-2), para que no la tape el botón por el que pasa. */}
                      {activo ? (
                        <motion.span
                          layoutId="biblioteca-filtro-activo"
                          className="absolute -inset-[2px] z-[1] rounded-full bg-[#2C3E50]"
                          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="relative z-[2] inline-flex items-center gap-1.5 transition-transform duration-150 active:scale-95 motion-reduce:transition-none">
                        {f === 'TODAS' ? 'Todas' : CATEGORY_LABEL[f]}
                        {/* El hueco del contador existe siempre y con ancho fijo (en em, cabe «20»): la píldora no
                            cambia de tamaño al llegar los datos ni al pasar de una a dos cifras, y la oscura no se mueve. */}
                        <span
                          className={`inline-flex w-[2.6em] justify-center rounded-full text-[11px] leading-[1.15rem] font-black transition-colors duration-200 ${
                            activo ? 'bg-white/20 text-white' : n === 0 ? 'bg-[#F5F1EE] text-[#7D8A96]/50' : 'bg-[#F5F1EE] text-[#7D8A96]'
                          }`}
                        >
                          {n === null ? <span className="opacity-40">–</span> : <NumeroAnimado valor={n} />}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </motion.div>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {cargando ? 'Cargando las asignaturas…' : arbol ? `${tarjetas.length} ${tarjetas.length === 1 ? 'asignatura' : 'asignaturas'}` : ''}
            </p>

            <RejillaAnimada className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Listado de asignaturas">
                {cargando
                  ? Array.from({ length: ESQUELETOS }, (_, i) => (
                      <motion.div
                        key={`esqueleto-${i}`}
                        className="h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.12 + Math.min(i, 6) * 0.03 } }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        aria-hidden
                      >
                        <TarjetaEsqueleto />
                      </motion.div>
                    ))
                  : null}

                {tarjetas.map(({ asignatura: a, cuenta, temasConMaterial, tieneGeneral }, i) => {
                  const h = acierto.get(a.id)
                  const guia = guiaDeAsignatura(a.id)
                  const carpetas = temasConMaterial + (tieneGeneral ? 1 : 0)
                  return (
                    <ItemAnimado key={a.id} indice={i} className="h-full">
                      <Link href={`/library/${a.id}`} className="group block h-full rounded-3xl outline-none">
                        <StickerCard
                          className={`flex h-full flex-col gap-4 p-5 ${PEGATINA_4}`}
                          style={{ boxShadow: undefined }}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`inline-flex shrink-0 ${GIRO_HOVER}`}>
                              <Sigla asignatura={a} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-lg leading-tight font-black text-[#2C3E50] transition-colors duration-200 group-hover:text-[#C97D6F]">
                                <Resaltado texto={a.nombre} q={q} />
                              </h3>
                              <p className="mt-0.5 truncate text-xs text-[#7D8A96]">
                                {a.subtitulo ?? (a.temas.length ? `${a.temas.length} temas en el catálogo` : 'Temas en camino')}
                              </p>
                            </div>
                            {guia ? (
                              <span className="shrink-0 rounded-full bg-[#E8A598]/15 px-2 py-0.5 text-[10px] font-black tracking-wide text-[#B5655A] uppercase" title="Tiene guía de estudio">
                                Guía
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-auto flex flex-col gap-2 border-t-2 border-dashed border-[#EAE4E2] pt-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black tracking-wide text-[#7D8A96]/70 uppercase">Tu material</span>
                              <CifrasMaterial cuenta={cuenta} compacto />
                            </div>
                            {carpetas > 0 ? (
                              <p className="text-right text-[11px] font-semibold text-[#7D8A96]">
                                en {carpetas} {carpetas === 1 ? 'carpeta' : 'carpetas'}
                              </p>
                            ) : null}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black tracking-wide text-[#7D8A96]/70 uppercase">Preguntas</span>
                              {/* El acierto llega después que el catálogo: aparece con un fundido, no de golpe. */}
                              <motion.span key={h ? 'con' : 'sin'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                                <CifrasPreguntas preguntas={null} acierto={h?.accuracy ?? null} respondidas={h?.total ?? 0} soloAcierto />
                              </motion.span>
                            </div>
                          </div>
                        </StickerCard>
                      </Link>
                    </ItemAnimado>
                  )
                })}

                {vacio ? (
                  <motion.div
                    key="vacio"
                    className="col-span-full"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { ...TRANSICION, delay: 0.08 } }}
                    exit={{ opacity: 0, transition: SALIDA }}
                  >
                    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[#E6DEDA] px-6 py-10 text-center">
                      <span className="inline-flex text-[#7D8A96]/60" aria-hidden>
                        <span className="material-symbols-outlined text-[32px]">search_off</span>
                      </span>
                      <p className="text-sm font-bold text-[#7D8A96]">
                        {busca ? (
                          <>
                            Nada con «{busca}»{filtro !== 'TODAS' ? ` en ${CATEGORY_LABEL[filtro]}` : ''}.
                          </>
                        ) : (
                          <>Ninguna asignatura en {filtro !== 'TODAS' ? CATEGORY_LABEL[filtro] : 'el catálogo'}.</>
                        )}
                      </p>
                      {busca || filtro !== 'TODAS' ? (
                        <button
                          type="button"
                          onClick={() => {
                            // Si quitar el filtro ya da resultados, se conserva la búsqueda.
                            if (filtro !== 'TODAS' && (porFiltro?.TODAS ?? 0) > 0) setFiltro('TODAS')
                            else {
                              setFiltro('TODAS')
                              limpiarBusqueda()
                            }
                          }}
                          className="rounded-full border-2 border-[#2c3e50] bg-white px-4 py-1.5 text-sm font-extrabold text-[#2C3E50] transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#2c3e50] active:translate-y-0 active:shadow-none"
                        >
                          {filtro !== 'TODAS' && porFiltro && porFiltro.TODAS > 0 ? `Buscar en todas (${porFiltro.TODAS})` : 'Ver todas'}
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
            </RejillaAnimada>
          </motion.section>
        </div>
      </main>
    </PaginaConMovimiento>
  )
}

/** Hueco de carga con la forma de una tarjeta (sigla, título, cifras), sin sombra: aún no hay nada que tocar. */
function TarjetaEsqueleto() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border-2 border-[#EAE4E2] bg-white/70 p-5">
      <div className="flex items-start gap-3 motion-safe:animate-pulse">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-[#F0EAE7]" />
        {/* Título de dos líneas y subtítulo, como la mayoría de las tarjetas. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
          <span className="h-4 w-3/4 rounded-full bg-[#F0EAE7]" />
          <span className="h-4 w-1/2 rounded-full bg-[#F0EAE7]" />
          <span className="mt-1 h-3 w-2/5 rounded-full bg-[#F5F1EE]" />
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 border-t-2 border-dashed border-[#EAE4E2] pt-3 motion-safe:animate-pulse">
        <div className="flex items-center justify-between">
          <span className="h-3 w-20 rounded-full bg-[#F5F1EE]" />
          <span className="h-5 w-16 rounded-full bg-[#F0EAE7]" />
        </div>
        <div className="flex items-center justify-between">
          <span className="h-3 w-16 rounded-full bg-[#F5F1EE]" />
          <span className="h-3 w-20 rounded-full bg-[#F0EAE7]" />
        </div>
      </div>
    </div>
  )
}
