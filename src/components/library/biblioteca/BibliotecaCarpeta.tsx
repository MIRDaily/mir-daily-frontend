'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import MoverACarpeta from '@/components/carpetas/MoverACarpeta'
import { carpetaDeSegmento, carpetasDeAsignatura, type ElementoMaterial } from '@/lib/carpetas/biblioteca'
import { useDatosAsignatura } from '@/components/library/biblioteca/useDatosAsignatura'
import { Estado, FilaElemento, HuecoDominio, SectionLabel, Sigla, StickerCard, colorAcierto } from '@/components/library/biblioteca/ui'

// Una carpeta (un tema, o «General» de la asignatura): dos bloques lado a lado y SIN mezclar cifras (D2).
//  - Preguntas MIR: cuántas tiene el tema y el acierto del usuario en ellas (analíticas de siempre).
//  - Tu material: sus mapas y grupos, con abrir, estudiar y «Mover a…». Debajo, el hueco de la señal de
//    dominio del material (fase 3), que todavía no se calcula.

export default function BibliotecaCarpeta({ subjectId, segmento }: { subjectId: number; segmento: string }) {
  const { datos, error, aciertoDe, preguntasDe, detalleDe, recargar } = useDatosAsignatura(subjectId)
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

  const elementos = useMemo(() => {
    if (!asig || !datos || !carpeta) return []
    return carpetasDeAsignatura(asig, datos.elementos).find((c) => c.topicId === carpeta.topicId)?.elementos ?? []
  }, [asig, datos, carpeta])

  if (error || (asig && !carpeta)) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <StickerCard className="p-6">
          <Estado error={!!error && !error.noExiste}>{error && !error.noExiste ? error.mensaje : 'Esa carpeta no está en la Biblioteca.'}</Estado>
          <p className="text-center">
            <Link href={asig ? `/library/${subjectId}` : '/library'} className="text-sm font-black text-[#C97D6F] hover:underline">
              Volver
            </Link>
          </p>
        </StickerCard>
      </main>
    )
  }
  if (!asig || !datos || !carpeta) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Estado>Cargando la carpeta…</Estado>
      </main>
    )
  }

  const esGeneral = carpeta.topicId === null
  const a = aciertoDe(carpeta.topicId)
  const d = detalleDe(carpeta.topicId)
  const preguntas = preguntasDe(carpeta.topicId) ?? 0

  return (
    <main className="min-h-screen bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] sm:px-6 [@media(max-height:850px)]:py-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 [@media(max-height:850px)]:gap-6">
        <header className="flex items-center gap-4">
          <Sigla asignatura={asig} grande />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#7D8A96]">
              <Link href={`/library/${subjectId}`} className="hover:text-[#C97D6F]">
                {asig.nombre}
              </Link>
            </p>
            <h1 className="text-3xl leading-tight font-black tracking-tight text-[#2C3E50] sm:text-4xl">{carpeta.nombre}</h1>
            {esGeneral ? <p className="text-sm text-[#7D8A96]">Lo que abarca varios temas de {asig.nombreCorto}</p> : null}
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <StickerCard as="section" className="flex flex-col gap-4 p-5" depth={5}>
            <SectionLabel>Preguntas MIR</SectionLabel>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-4xl font-black text-[#2C3E50] tabular-nums">{preguntas}</p>
                <p className="text-xs font-bold text-[#7D8A96]">{esGeneral ? 'en toda la asignatura' : 'de este tema'}</p>
              </div>
              <div>
                <p className="text-4xl font-black tabular-nums" style={{ color: a.respondidas && a.acierto !== null ? colorAcierto(a.acierto) : '#C9BFB9' }}>
                  {a.respondidas && a.acierto !== null ? `${Math.round(a.acierto)} %` : '—'}
                </p>
                <p className="text-xs font-bold text-[#7D8A96]">tu acierto</p>
              </div>
            </div>
            {d && d.total > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-[#EAF1E9] px-2.5 py-1 text-[#5C7A59]">{d.correct} bien</span>
                <span className="rounded-full bg-[#FBEDE9] px-2.5 py-1 text-[#B5675A]">{d.wrong} mal</span>
                <span className="rounded-full bg-[#F2EFED] px-2.5 py-1 text-[#7D8A96]">{d.blank} en blanco</span>
              </div>
            ) : (
              <p className="text-sm text-[#7D8A96]">Todavía no has respondido preguntas {esGeneral ? 'de esta asignatura' : 'de este tema'}.</p>
            )}
            <p className="text-[11px] leading-relaxed text-[#7D8A96]/80">
              Tus respuestas en el daily, los simulacros y los mazos de preguntas. Tu material propio no cuenta aquí.
            </p>
            <Link
              href="/studio/simulacro"
              className="inline-flex items-center gap-1.5 self-start rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2 text-xs font-extrabold text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2C3E50]"
            >
              <span className="material-symbols-outlined text-[16px]">quiz</span>
              Practicar en un simulacro
            </Link>
          </StickerCard>

          <StickerCard as="section" className="flex flex-col gap-4 p-5" depth={5}>
            <SectionLabel right={<span className="text-[11px] font-bold text-[#7D8A96]/70">{elementos.length}</span>}>Tu material</SectionLabel>
            {elementos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="material-symbols-outlined text-[36px] text-[#E8A598]">folder_open</span>
                <p className="text-sm text-[#7D8A96]">Esta carpeta se ha quedado vacía.</p>
                <Link href={`/library/${subjectId}`} className="text-sm font-black text-[#C97D6F] hover:underline">
                  Volver a {asig.nombreCorto}
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {elementos.map((e) => (
                  <FilaElemento
                    key={`${e.tipo}:${e.id}`}
                    e={e}
                    acciones={
                      <button
                        type="button"
                        onClick={() => setMoviendo(e)}
                        className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-extrabold text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#2C3E50]"
                        title="Mover a otra carpeta"
                      >
                        <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                        Mover
                      </button>
                    }
                  />
                ))}
              </ul>
            )}
            <HuecoDominio compacto />
          </StickerCard>
        </div>
      </div>
      {moviendo ? (
        <MoverACarpeta
          tipo={moviendo.tipo}
          id={moviendo.id}
          titulo={moviendo.titulo}
          actual={moviendo.carpeta}
          onClose={() => setMoviendo(null)}
          onMovido={() => recargar()}
        />
      ) : null}
    </main>
  )
}
