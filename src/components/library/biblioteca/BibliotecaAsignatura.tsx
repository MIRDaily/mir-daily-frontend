'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { guiaDeAsignatura } from '@/lib/studyGuides'
import { carpetasDeAsignatura, cuentaDe, rutaCarpeta } from '@/lib/carpetas/biblioteca'
import { useDatosAsignatura } from '@/components/library/biblioteca/useDatosAsignatura'
import { IndicadorDominio } from '@/components/library/biblioteca/dominioUi'
import { estadoDominio, porcentaje, UMBRAL_BIEN_LLEVADO } from '@/lib/carpetas/dominio'
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

// Una asignatura de la Biblioteca: «General» y SOLO los temas en los que el usuario tiene material (§3.3).
// Cada carpeta enseña dos indicadores separados: sus preguntas MIR y su material (D2), y dentro del
// material, la señal de dominio (fase 3) con su propio color, nunca junto a la cifra de preguntas.

export default function BibliotecaAsignatura({ subjectId }: { subjectId: number }) {
  const { datos, error, aciertoDe, preguntasDe, dominioDe, dominioDisponible } = useDatosAsignatura(subjectId)
  const { setBackAction } = useHeaderUI()
  const asig = datos?.asignatura ?? null

  useEffect(() => {
    setBackAction({ label: 'Biblioteca', href: '/library', current: asig?.nombreCorto })
    return () => setBackAction(null)
  }, [setBackAction, asig?.nombreCorto])

  const carpetas = useMemo(() => (asig && datos ? carpetasDeAsignatura(asig, datos.elementos) : []), [asig, datos])
  const total = useMemo(() => cuentaDe(datos?.elementos ?? []), [datos])
  const guia = guiaDeAsignatura(subjectId)
  const general = aciertoDe(null)
  const temasConMaterial = carpetas.filter((c) => c.topicId !== null).length
  const ocultos = asig ? asig.temas.length - temasConMaterial : 0
  // Las carpetas que pueden tener señal: las que tienen algún grupo de flashcards o de resúmenes.
  const medibles = carpetas.filter((c) => c.cuenta.flashcards + c.cuenta.resumenes > 0)

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <StickerCard className="p-6">
          <Estado error={!error.noExiste}>{error.noExiste ? 'Esa asignatura no está en la Biblioteca.' : error.mensaje}</Estado>
          <p className="text-center">
            <Link href="/library" className="text-sm font-black text-[#C97D6F] hover:underline">
              Volver a la Biblioteca
            </Link>
          </p>
        </StickerCard>
      </main>
    )
  }
  if (!asig || !datos) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Estado>Cargando la asignatura…</Estado>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] sm:px-6 [@media(max-height:850px)]:py-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 [@media(max-height:850px)]:gap-6">
        <header
          className="relative overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-gradient-to-br from-white via-[#FFFBFA] to-[#FFF2ED] px-6 py-6 sm:px-8"
          style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
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
                <span className="text-lg font-black text-[#2C3E50] tabular-nums">{datos.preguntas.total}</span>
                <span className="text-[11px] font-bold tracking-wide text-[#7D8A96]/70 uppercase">preguntas MIR</span>
              </span>
              <span className="flex items-baseline gap-1.5 rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2">
                <span className="text-lg font-black tabular-nums" style={{ color: general.acierto !== null && general.respondidas ? colorAcierto(general.acierto) : '#7D8A96' }}>
                  {general.acierto !== null && general.respondidas ? `${Math.round(general.acierto)} %` : '—'}
                </span>
                <span className="text-[11px] font-bold tracking-wide text-[#7D8A96]/70 uppercase">acierto</span>
              </span>
              <span className="flex items-baseline gap-1.5 rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2">
                <span className="text-lg font-black text-[#E8A598] tabular-nums">{total.total}</span>
                <span className="text-[11px] font-bold tracking-wide text-[#7D8A96]/70 uppercase">de tu material</span>
              </span>
            </div>
          </div>
          {guia ? (
            <Link
              href={`/library/${subjectId}/guia`}
              className="relative mt-5 inline-flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-4 py-2 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              Guía de estudio {guia.targetExam}
            </Link>
          ) : null}
        </header>

        <section>
          <SectionLabel>Tus carpetas</SectionLabel>
          {carpetas.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {carpetas.map((c) => {
                const a = aciertoDe(c.topicId)
                return (
                  <Link key={c.topicId ?? 'general'} href={rutaCarpeta(subjectId, c.topicId)} className="group block h-full">
                    <StickerCard className="flex h-full flex-col gap-3 p-5 transition-transform group-hover:-translate-y-0.5" depth={4}>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[26px] text-[#E8A598]">{c.topicId === null ? 'folder_special' : 'folder'}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg leading-tight font-black text-[#2C3E50] group-hover:text-[#C97D6F]">{c.nombre}</h3>
                          {c.topicId === null ? <p className="text-xs text-[#7D8A96]">Lo que abarca varios temas de la asignatura</p> : null}
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-[#7D8A96] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
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
                )
              })}
            </div>
          )}
          {ocultos > 0 ? (
            <p className="mt-4 text-xs text-[#7D8A96]">
              {ocultos} {ocultos === 1 ? 'tema' : 'temas'} del catálogo sin material: no se enseñan hasta que archives algo en ellos (al guardar o con «Mover a…»).
            </p>
          ) : null}
        </section>

        {carpetas.length > 0 && dominioDisponible === false ? <HuecoDominio /> : null}
        {medibles.length > 0 && dominioDisponible ? (
          <p className="text-xs text-[#7D8A96]">
            {medibles.filter((c) => estadoDominio(dominioDe(c.topicId)) === 'bien').length} de {medibles.length}{' '}
            {medibles.length === 1 ? 'carpeta con flashcards o resúmenes está bien llevada' : 'carpetas con flashcards o resúmenes están bien llevadas'} (recordarías hoy al
            menos el {porcentaje(UMBRAL_BIEN_LLEVADO.dominio)} % y has visto el {porcentaje(UMBRAL_BIEN_LLEVADO.cobertura)} % o más). Los mapas no cuentan: no registran estudio.
          </p>
        ) : null}
      </div>
    </main>
  )
}
