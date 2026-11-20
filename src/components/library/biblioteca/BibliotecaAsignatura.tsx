'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { guiaDeAsignatura } from '@/lib/studyGuides'
import { carpetasDeAsignatura, cuentaDe, rutaCarpeta } from '@/lib/carpetas/biblioteca'
import { useDatosAsignatura } from '@/components/library/biblioteca/useDatosAsignatura'
import { IndicadorDominio } from '@/components/library/biblioteca/dominioUi'
import { estadoDominio, porcentaje, UMBRAL_BIEN_LLEVADO } from '@/lib/carpetas/dominio'
import { useScrollRecordado } from '@/hooks/useMemoriaDePestana'
import {
  CifrasMaterial,
  CifrasPreguntas,
  Estado,
  HuecoDominio,
  INK,
  SectionLabel,
  Sigla,
  StickerCard,
  TEXTURA_LOMOS,
  colorAcierto,
} from '@/components/library/biblioteca/ui'
import {
  EMPUJE_HOVER,
  Esqueleto,
  GIRO_HOVER,
  ItemAnimado,
  NumeroAnimado,
  PEGATINA_3,
  PEGATINA_4,
  PaginaConMovimiento,
  RejillaAnimada,
  entrada,
} from '@/components/ui/movimiento'

// Una asignatura de la Biblioteca: «General» y SOLO los temas en los que el usuario tiene material (§3.3).
// Cada carpeta enseña dos indicadores separados: sus preguntas MIR y su material (D2), y dentro del
// material, la señal de dominio (fase 3) con su propio color, nunca junto a la cifra de preguntas.
// Movimiento: la cabecera y las carpetas entran en cascada la primera vez; al volver (datos en memoria)
// la página ya está hecha y el scroll donde se dejó.

const ESQUELETOS = 4

export default function BibliotecaAsignatura({ subjectId }: { subjectId: number }) {
  const { datos, error, deMemoria, aciertoDe, preguntasDe, dominioDe, dominioDisponible } = useDatosAsignatura(subjectId)
  const { setBackAction } = useHeaderUI()
  const asig = datos?.asignatura ?? null

  useEffect(() => {
    setBackAction({ label: 'Biblioteca', href: '/library', current: asig?.nombreCorto })
    return () => setBackAction(null)
  }, [setBackAction, asig?.nombreCorto])

  const raizScroll = useScrollRecordado(`biblioteca:asignatura:${subjectId}`, !!datos)

  const carpetas = useMemo(() => (asig && datos ? carpetasDeAsignatura(asig, datos.elementos) : []), [asig, datos])
  const total = useMemo(() => cuentaDe(datos?.elementos ?? []), [datos])
  const guia = guiaDeAsignatura(subjectId)
  const general = aciertoDe(null)
  const temasConMaterial = carpetas.filter((c) => c.topicId !== null).length
  const ocultos = asig ? asig.temas.length - temasConMaterial : 0
  // Las carpetas que pueden tener señal: las que tienen algún grupo de flashcards o de resúmenes.
  const medibles = carpetas.filter((c) => c.cuenta.flashcards + c.cuenta.resumenes > 0)
  const hayAcierto = general.acierto !== null && general.respondidas > 0

  if (error) {
    return (
      <PaginaConMovimiento>
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
          <motion.div {...entrada(0)}>
            <StickerCard className="p-6">
              <Estado error={!error.noExiste}>{error.noExiste ? 'Esa asignatura no está en la Biblioteca.' : error.mensaje}</Estado>
              <p className="text-center">
                <Link href="/library" className="text-sm font-black text-[#C97D6F] hover:underline">
                  Volver a la Biblioteca
                </Link>
              </p>
            </StickerCard>
          </motion.div>
        </main>
      </PaginaConMovimiento>
    )
  }

  return (
    <PaginaConMovimiento animarEntrada={!deMemoria}>
      <main ref={raizScroll} className="min-h-screen overflow-x-clip bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] sm:px-6 [@media(max-height:850px)]:py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 [@media(max-height:850px)]:gap-6">
          {!asig || !datos ? (
            <CabeceraEsqueleto />
          ) : (
            <motion.header
              className="relative overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-gradient-to-br from-white via-[#FFFBFA] to-[#FFF2ED] px-6 py-6 sm:px-8"
              style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
              {...entrada(0)}
            >
              <div className="pointer-events-none absolute inset-0" style={TEXTURA_LOMOS} />
              <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
                <Sigla asignatura={asig} grande />
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl leading-tight font-black tracking-tight text-[#2C3E50] sm:text-4xl">{asig.nombre}</h1>
                  <p className="mt-1 text-base text-[#7D8A96]">
                    {asig.subtitulo ?? (asig.temas.length ? `${asig.temas.length} temas en el catálogo` : 'Sus temas llegarán con su paquete de preguntas')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <span className="flex items-baseline gap-1.5 rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2">
                    <NumeroAnimado valor={datos.preguntas.total} className="text-lg font-black text-[#2C3E50]" />
                    <span className="text-[11px] font-bold tracking-wide text-[#7D8A96]/70 uppercase">preguntas MIR</span>
                  </span>
                  <span className="flex items-baseline gap-1.5 rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2">
                    {/* El acierto llega en otra petición: el guion se funde con la cifra en vez de saltar. */}
                    <AnimatePresence initial={false} mode="popLayout">
                      {hayAcierto ? (
                        <motion.span
                          key="acierto"
                          className="transition-colors duration-300"
                          style={{ color: colorAcierto(general.acierto ?? 0) }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <NumeroAnimado valor={Math.round(general.acierto ?? 0)} sufijo=" %" className="text-lg font-black" />
                        </motion.span>
                      ) : (
                        <motion.span key="guion" className="text-lg font-black text-[#7D8A96]" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                          —
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="text-[11px] font-bold tracking-wide text-[#7D8A96]/70 uppercase">acierto</span>
                  </span>
                  <span className="flex items-baseline gap-1.5 rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2">
                    <NumeroAnimado valor={total.total} className="text-lg font-black text-[#E8A598]" />
                    <span className="text-[11px] font-bold tracking-wide text-[#7D8A96]/70 uppercase">de tu material</span>
                  </span>
                </div>
              </div>
              {guia ? (
                <Link href={`/library/${subjectId}/guia`} className="group relative mt-5 inline-flex rounded-2xl outline-none">
                  <span className={`inline-flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-4 py-2 text-sm font-black text-white ${PEGATINA_3}`}>
                    <span className="material-symbols-outlined text-[18px]">menu_book</span>
                    Guía de estudio {guia.targetExam}
                  </span>
                </Link>
              ) : null}
            </motion.header>
          )}

          <motion.section {...entrada(0.08)}>
            <SectionLabel>Tus carpetas</SectionLabel>
            {datos && asig && carpetas.length === 0 ? (
              <motion.div {...entrada(0.1)}>
                <StickerCard className="flex flex-col items-center gap-3 p-8 text-center" depth={4}>
                  <span className="material-symbols-outlined text-[40px] text-[#E8A598]">folder_open</span>
                  <p className="max-w-md text-sm text-[#7D8A96]">
                    Aún no tienes material en {asig.nombreCorto}. Cuando guardes aquí un mapa, un grupo de flashcards o de resúmenes, sus temas
                    aparecerán en esta página, cada uno junto a sus preguntas MIR.
                  </p>
                  <Link href="/library/sin-clasificar" className="text-sm font-black text-[#C97D6F] hover:underline">
                    Ordenar lo que tienes sin clasificar
                  </Link>
                </StickerCard>
              </motion.div>
            ) : (
              <RejillaAnimada className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Carpetas de la asignatura">
                {!datos
                  ? Array.from({ length: ESQUELETOS }, (_, i) => (
                      <ItemAnimado key={`esqueleto-${i}`} indice={i} className="h-full">
                        <CarpetaEsqueleto />
                      </ItemAnimado>
                    ))
                  : null}
                {carpetas.map((c, i) => {
                  const a = aciertoDe(c.topicId)
                  return (
                    <ItemAnimado key={c.topicId ?? 'general'} indice={i} className="h-full">
                      <Link href={rutaCarpeta(subjectId, c.topicId)} className="group block h-full rounded-3xl outline-none">
                        <StickerCard className={`flex h-full flex-col gap-3 p-5 ${PEGATINA_4}`} style={{ boxShadow: undefined }}>
                          <div className="flex items-start gap-3">
                            <span className={`inline-flex shrink-0 ${GIRO_HOVER}`} aria-hidden>
                              <span className="material-symbols-outlined text-[26px] text-[#E8A598]">{c.topicId === null ? 'folder_special' : 'folder'}</span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg leading-tight font-black text-[#2C3E50] transition-colors duration-200 group-hover:text-[#C97D6F]">{c.nombre}</h3>
                              {c.topicId === null ? <p className="text-xs text-[#7D8A96]">Lo que abarca varios temas de la asignatura</p> : null}
                            </div>
                            <span className={`shrink-0 text-[#7D8A96] ${EMPUJE_HOVER}`} aria-hidden>
                              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </span>
                          </div>
                          <div className="mt-auto grid grid-cols-2 gap-3 border-t-2 border-dashed border-[#EAE4E2] pt-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[11px] font-black tracking-wide text-[#7D8A96]/70 uppercase">
                                Preguntas MIR{c.topicId === null ? ' · toda' : ''}
                              </span>
                              <CifrasPreguntas preguntas={preguntasDe(c.topicId)} acierto={a.acierto} respondidas={a.respondidas} />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="text-[11px] font-black tracking-wide text-[#7D8A96]/70 uppercase">Tu material</span>
                              <CifrasMaterial cuenta={c.cuenta} compacto />
                              {dominioDisponible !== false ? <IndicadorDominio d={dominioDe(c.topicId)} cargando={dominioDisponible === null} /> : null}
                            </div>
                          </div>
                        </StickerCard>
                      </Link>
                    </ItemAnimado>
                  )
                })}
              </RejillaAnimada>
            )}
            <AnimatePresence initial={false}>
              {ocultos > 0 ? (
                <motion.p key="ocultos" className="mt-4 text-xs text-[#7D8A96]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {ocultos} {ocultos === 1 ? 'tema' : 'temas'} del catálogo sin material: no se enseñan hasta que archives algo en ellos (al guardar o con «Mover a…»).
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.section>

          {carpetas.length > 0 && dominioDisponible === false ? (
            <motion.div {...entrada(0)}>
              <HuecoDominio />
            </motion.div>
          ) : null}
          {medibles.length > 0 && dominioDisponible ? (
            <motion.p className="text-xs text-[#7D8A96]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
              {medibles.filter((c) => estadoDominio(dominioDe(c.topicId)) === 'bien').length} de {medibles.length}{' '}
              {medibles.length === 1 ? 'carpeta con flashcards o resúmenes está bien llevada' : 'carpetas con flashcards o resúmenes están bien llevadas'} (recordarías hoy al
              menos el {porcentaje(UMBRAL_BIEN_LLEVADO.dominio)} % y has visto el {porcentaje(UMBRAL_BIEN_LLEVADO.cobertura)} % o más). Los mapas no cuentan: no registran estudio.
            </motion.p>
          ) : null}
        </div>
      </main>
    </PaginaConMovimiento>
  )
}

/** La cabecera mientras llega la asignatura: misma caja (sin sombra todavía), sigla y título en hueso. */
function CabeceraEsqueleto() {
  return (
    <div className="rounded-3xl border-2 border-[#EAE4E2] bg-white/70 px-6 py-6 sm:px-8" aria-hidden>
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <Esqueleto className="h-14 w-14 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Esqueleto className="h-8 w-2/3 sm:h-9" />
          <Esqueleto className="h-4 w-1/3" />
        </div>
        <div className="flex gap-2">
          <Esqueleto className="h-11 w-28 rounded-xl" />
          <Esqueleto className="h-11 w-24 rounded-xl" />
          <Esqueleto className="h-11 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/** Hueco de una carpeta: icono, nombre y las dos columnas de cifras. */
function CarpetaEsqueleto() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-3xl border-2 border-[#EAE4E2] bg-white/70 p-5" aria-hidden>
      <div className="flex items-start gap-3">
        <Esqueleto className="h-7 w-7 rounded-lg" />
        <Esqueleto className="mt-1 h-5 w-1/2" />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 border-t-2 border-dashed border-[#EAE4E2] pt-3">
        <div className="flex flex-col gap-2">
          <Esqueleto className="h-3 w-20" />
          <Esqueleto className="h-5 w-24" />
        </div>
        <div className="flex flex-col gap-2">
          <Esqueleto className="h-3 w-16" />
          <Esqueleto className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}
