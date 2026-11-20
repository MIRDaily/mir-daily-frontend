'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import MoverACarpeta from '@/components/carpetas/MoverACarpeta'
import { carpetaDeSegmento, carpetasDeAsignatura, type ElementoMaterial } from '@/lib/carpetas/biblioteca'
import { useDatosAsignatura } from '@/components/library/biblioteca/useDatosAsignatura'
import { LineaDominioGrupo, SenalDominio } from '@/components/library/biblioteca/dominioUi'
import { useScrollRecordado } from '@/hooks/useMemoriaDePestana'
import { Estado, FilaElemento, HuecoDominio, SectionLabel, Sigla, StickerCard, colorAcierto } from '@/components/library/biblioteca/ui'
import { AlturaAnimada, Esqueleto, NumeroAnimado, PaginaConMovimiento, RejillaAnimada, entrada } from '@/components/ui/movimiento'

// Una carpeta (un tema, o «General» de la asignatura): dos bloques lado a lado y SIN mezclar cifras (D2).
//  - Preguntas MIR: cuántas tiene el tema y el acierto del usuario en ellas (analíticas de siempre).
//  - Tu material: arriba, la señal de dominio del material (fase 3: cuánto recordarías hoy, cuánto has
//    visto, último repaso, huecos débiles); debajo, sus mapas y grupos, con abrir, estudiar y «Mover a…».
// Movimiento: las filas entran en cascada y, al mover una, sale hacia la derecha y las demás suben; lo que
// llega más tarde (acierto, señal de dominio) crece con la altura animada en vez de empujar de golpe.

export default function BibliotecaCarpeta({ subjectId, segmento }: { subjectId: number; segmento: string }) {
  const { datos, error, deMemoria, aciertoDe, preguntasDe, detalleDe, dominioDe, dominioDisponible, movido } = useDatosAsignatura(subjectId)
  const { setBackAction } = useHeaderUI()
  const [moviendo, setMoviendo] = useState<ElementoMaterial | null>(null)
  const asig = datos?.asignatura ?? null
  const carpeta = asig ? carpetaDeSegmento(asig, segmento) : undefined

  useEffect(() => {
    if (!asig) return
    setBackAction({
      label: 'Biblioteca',
      href: '/library',
      trail: [{ label: asig.nombreCorto, href: `/library/${subjectId}` }],
      current: carpeta?.nombre,
    })
    return () => setBackAction(null)
  }, [setBackAction, asig, subjectId, carpeta?.nombre])

  const raizScroll = useScrollRecordado(`biblioteca:carpeta:${subjectId}:${segmento}`, !!carpeta)

  const elementos = useMemo(() => {
    if (!asig || !datos || !carpeta) return []
    return carpetasDeAsignatura(asig, datos.elementos).find((c) => c.topicId === carpeta.topicId)?.elementos ?? []
  }, [asig, datos, carpeta])

  if (error || (asig && !carpeta)) {
    return (
      <PaginaConMovimiento>
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
          <motion.div {...entrada(0)}>
            <StickerCard className="p-6">
              <Estado error={!!error && !error.noExiste}>{error && !error.noExiste ? error.mensaje : 'Esa carpeta no está en la Biblioteca.'}</Estado>
              <p className="text-center">
                <Link href={asig ? `/library/${subjectId}` : '/library'} className="text-sm font-black text-[#C97D6F] hover:underline">
                  Volver
                </Link>
              </p>
            </StickerCard>
          </motion.div>
        </main>
      </PaginaConMovimiento>
    )
  }
  if (!asig || !datos || !carpeta) {
    return (
      <PaginaConMovimiento>
        <CarpetaEsqueleto />
      </PaginaConMovimiento>
    )
  }

  const esGeneral = carpeta.topicId === null
  const dominio = dominioDe(carpeta.topicId)
  const a = aciertoDe(carpeta.topicId)
  const d = detalleDe(carpeta.topicId)
  const preguntas = preguntasDe(carpeta.topicId) ?? 0
  const hayAcierto = !!a.respondidas && a.acierto !== null

  return (
    <PaginaConMovimiento animarEntrada={!deMemoria}>
      <main ref={raizScroll} className="min-h-screen overflow-x-clip bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] sm:px-6 [@media(max-height:850px)]:py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 [@media(max-height:850px)]:gap-6">
          <motion.header className="flex items-center gap-4" {...entrada(0)}>
            <Sigla asignatura={asig} grande />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#7D8A96]">
                <Link href={`/library/${subjectId}`} className="transition-colors hover:text-[#C97D6F]">
                  {asig.nombre}
                </Link>
              </p>
              <h1 className="text-3xl leading-tight font-black tracking-tight text-[#2C3E50] sm:text-4xl">{carpeta.nombre}</h1>
              {esGeneral ? <p className="text-sm text-[#7D8A96]">Lo que abarca varios temas de {asig.nombreCorto}</p> : null}
            </div>
          </motion.header>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <motion.div {...entrada(0.06)}>
              <StickerCard as="section" className="flex flex-col gap-4 p-5" depth={5}>
                <SectionLabel>Preguntas MIR</SectionLabel>
                <div className="flex items-end gap-6">
                  <div>
                    <NumeroAnimado valor={preguntas} className="text-4xl font-black text-[#2C3E50]" />
                    <p className="text-xs font-bold text-[#7D8A96]">{esGeneral ? 'en toda la asignatura' : 'de este tema'}</p>
                  </div>
                  <div>
                    <p
                      className="text-4xl font-black tabular-nums transition-colors duration-300"
                      style={{ color: hayAcierto ? colorAcierto(a.acierto ?? 0) : '#C9BFB9' }}
                    >
                      {hayAcierto ? <NumeroAnimado valor={Math.round(a.acierto ?? 0)} sufijo=" %" /> : '—'}
                    </p>
                    <p className="text-xs font-bold text-[#7D8A96]">tu acierto</p>
                  </div>
                </div>
                {/* El detalle llega en otra petición: la caja crece con suavidad en vez de empujar de golpe. */}
                <AlturaAnimada>
                  <AnimatePresence initial={false} mode="wait">
                    {d && d.total > 0 ? (
                      <motion.div
                        key="detalle"
                        className="flex flex-wrap gap-2 text-xs font-bold"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="rounded-full bg-[#EAF1E9] px-2.5 py-1 text-[#5C7A59]">{d.correct} bien</span>
                        <span className="rounded-full bg-[#FBEDE9] px-2.5 py-1 text-[#B5675A]">{d.wrong} mal</span>
                        <span className="rounded-full bg-[#F2EFED] px-2.5 py-1 text-[#7D8A96]">{d.blank} en blanco</span>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="sin"
                        className="text-sm text-[#7D8A96]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        Todavía no has respondido preguntas {esGeneral ? 'de esta asignatura' : 'de este tema'}.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </AlturaAnimada>
                <p className="text-[11px] leading-relaxed text-[#7D8A96]/80">
                  Tus respuestas en el daily, los simulacros y los mazos de preguntas. Tu material propio no cuenta aquí.
                </p>
                <Link
                  href="/studio/simulacro"
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2 text-xs font-extrabold text-[#7D8A96] transition-[color,border-color,translate] duration-150 hover:-translate-y-px hover:border-[#2c3e50] hover:text-[#2C3E50] active:translate-y-px motion-reduce:transition-none"
                >
                  <span className="material-symbols-outlined text-[16px]">quiz</span>
                  Practicar en un simulacro
                </Link>
              </StickerCard>
            </motion.div>

            <motion.div {...entrada(0.12)}>
              <StickerCard as="section" className="flex flex-col gap-4 p-5" depth={5}>
                <SectionLabel right={<NumeroAnimado valor={elementos.length} className="text-[11px] font-bold text-[#7D8A96]/70" />}>Tu material</SectionLabel>
                <AlturaAnimada>
                  {elementos.length > 0 ? (
                    dominioDisponible === false ? (
                      <HuecoDominio compacto />
                    ) : dominioDisponible === null ? (
                      <p className="text-xs font-bold text-[#7D8A96]">Calculando cuánto recordarías…</p>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                        <SenalDominio d={dominio} soloMapas={elementos.every((e) => e.tipo === 'mapa')} />
                      </motion.div>
                    )
                  ) : null}
                </AlturaAnimada>
                <RejillaAnimada as="ul" className="flex flex-col gap-2" aria-label="Material de la carpeta">
                  {elementos.map((e, i) => (
                    <FilaElemento
                      key={`${e.tipo}:${e.id}`}
                      e={e}
                      indice={i}
                      extra={e.tipo === 'mapa' ? null : <LineaDominioGrupo g={dominio?.grupos.find((g) => g.deckId === e.id)} />}
                      acciones={
                        <button
                          type="button"
                          onClick={() => setMoviendo(e)}
                          className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-extrabold text-[#7D8A96] transition-colors hover:bg-[#FAF7F4] hover:text-[#2C3E50] active:bg-[#F5F1EE]"
                          title="Mover a otra carpeta"
                        >
                          <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                          Mover
                        </button>
                      }
                    />
                  ))}
                </RejillaAnimada>
                <AnimatePresence initial={false}>
                  {elementos.length === 0 ? (
                    <motion.div
                      key="vacia"
                      className="flex flex-col items-center gap-2 py-6 text-center"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.12 } }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="material-symbols-outlined text-[36px] text-[#E8A598]">folder_open</span>
                      <p className="text-sm text-[#7D8A96]">Esta carpeta se ha quedado vacía.</p>
                      <Link href={`/library/${subjectId}`} className="text-sm font-black text-[#C97D6F] hover:underline">
                        Volver a {asig.nombreCorto}
                      </Link>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </StickerCard>
            </motion.div>
          </div>
        </div>
        {moviendo ? (
          <MoverACarpeta
            tipo={moviendo.tipo}
            id={moviendo.id}
            titulo={moviendo.titulo}
            actual={moviendo.carpeta}
            onClose={() => setMoviendo(null)}
            onMovido={(c) => movido(moviendo, c)}
          />
        ) : null}
      </main>
    </PaginaConMovimiento>
  )
}

/** La carpeta mientras llega: cabecera y los dos bloques en hueso, con su forma. */
function CarpetaEsqueleto() {
  return (
    <main className="min-h-screen bg-[#FAF7F4] px-4 py-8 sm:px-6 [@media(max-height:850px)]:py-5" aria-busy>
      <p className="sr-only">Cargando la carpeta…</p>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 [@media(max-height:850px)]:gap-6" aria-hidden>
        <div className="flex items-center gap-4">
          <Esqueleto className="h-14 w-14 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Esqueleto className="h-4 w-40" />
            <Esqueleto className="h-9 w-2/3 max-w-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-4 rounded-3xl border-2 border-[#EAE4E2] bg-white/70 p-5">
            <Esqueleto className="h-3 w-28" />
            <div className="flex gap-6">
              <Esqueleto className="h-10 w-20 rounded-xl" />
              <Esqueleto className="h-10 w-24 rounded-xl" />
            </div>
            <Esqueleto className="h-4 w-3/4" />
            <Esqueleto className="h-9 w-44 rounded-xl" />
          </div>
          <div className="flex flex-col gap-3 rounded-3xl border-2 border-[#EAE4E2] bg-white/70 p-5">
            <Esqueleto className="h-3 w-24" />
            {Array.from({ length: 3 }, (_, i) => (
              <Esqueleto key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
