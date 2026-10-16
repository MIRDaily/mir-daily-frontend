'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { cargarArbol, cargarRecuento } from '@/lib/carpetas/api'
import { normalizar, type AsignaturaCatalogo } from '@/lib/carpetas/sugerir'
import { tarjetasAsignaturas, textoCuenta, type Recuento } from '@/lib/carpetas/biblioteca'
import { fetchSubjectHeatmap, type SubjectHeatmapCell } from '@/services/analyticsService'
import { guiaDeAsignatura } from '@/lib/studyGuides'
import { CATEGORY_LABEL, type SubjectCategory } from '@/lib/subjectVisuals'
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

// Biblioteca (carpetas del material, fase 2): las asignaturas del catálogo, «Sin clasificar» arriba y, en
// cada asignatura, lo que el usuario tiene archivado. Las preguntas MIR van aparte, con sus analíticas de
// siempre: juntos, pero sin mezclar cifras (D2).

type Filtro = 'TODAS' | Exclude<SubjectCategory, 'PERSONAL'>
const FILTROS: Filtro[] = ['TODAS', 'MÉDICA', 'QUIRÚRGICA', 'BÁSICA']

export default function LibraryPage() {
  const [arbol, setArbol] = useState<AsignaturaCatalogo[] | null>(null)
  const [recuento, setRecuento] = useState<Recuento | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acierto, setAcierto] = useState<Map<number, SubjectHeatmapCell>>(new Map())
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('TODAS')

  useEffect(() => {
    let vivo = true
    Promise.all([cargarArbol(), cargarRecuento()])
      .then(([a, r]) => {
        if (!vivo) return
        setArbol(a)
        setRecuento(r)
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se pudo cargar la Biblioteca'))
    // El acierto en preguntas es un añadido: si falla, la Biblioteca se enseña igual.
    fetchSubjectHeatmap('all')
      .then((r) => vivo && setAcierto(new Map(r.subjects.map((s) => [s.subjectId, s]))))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const tarjetas = useMemo(() => {
    if (!arbol) return []
    const q = normalizar(busca)
    return tarjetasAsignaturas(arbol, recuento).filter(({ asignatura: a }) => {
      if (filtro !== 'TODAS' && visualAsignatura(a).category !== filtro) return false
      if (!q) return true
      return [a.nombre, a.nombreCorto, a.subtitulo ?? '', a.sigla ?? ''].some((t) => normalizar(t).includes(q))
    })
  }, [arbol, recuento, busca, filtro])

  const sin = recuento?.sinClasificar

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] antialiased sm:px-6 [@media(max-height:850px)]:py-5">
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 [@media(max-height:850px)]:gap-6">
        <Hero
          badge="Biblioteca"
          badgeIcon="local_library"
          title="Tu temario, carpeta a carpeta"
          subtitle="Cada asignatura con tus mapas, flashcards y resúmenes, junto a las preguntas MIR de cada tema."
          backdrop={<div className="pointer-events-none absolute inset-0" style={TEXTURA_LOMOS} />}
        />

        {error ? (
          <StickerCard className="p-6">
            <Estado error>{error}</Estado>
          </StickerCard>
        ) : null}

        <Link href="/library/sin-clasificar" className="group block">
          <StickerCard className="flex flex-col gap-3 p-5 transition-transform group-hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-5" depth={5}>
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2c3e50] bg-[#FCEFEC]"
              style={{ boxShadow: `3px 3px 0 0 ${INK}` }}
              aria-hidden
            >
              <span className="material-symbols-outlined text-[30px] text-[#C97D6F]">inbox</span>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-[#2C3E50]">
                Sin clasificar
                {sin ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-[#E8A598] px-2.5 py-0.5 align-middle text-sm font-black text-white tabular-nums">
                    {sin.total}
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-[#7D8A96]">
                {!recuento
                  ? 'Contando tu material…'
                  : sin && sin.total > 0
                    ? `${textoCuenta(sin)} sin carpeta. Muévelos a su asignatura para verlos junto a sus preguntas.`
                    : 'Todo tu material está en su carpeta.'}
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-sm font-black text-[#C97D6F] sm:inline-flex">
              Ordenar
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </span>
          </StickerCard>
        </Link>

        <section className="flex flex-col gap-4">
          <SectionLabel
            right={recuento ? <span className="text-[11px] font-bold text-[#7D8A96]/70">{recuento.total} en total</span> : null}
          >
            Asignaturas
          </SectionLabel>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative w-full md:max-w-sm">
              <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] text-[#7D8A96]">search</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busca una asignatura…"
                aria-label="Buscar asignatura"
                className="w-full rounded-2xl border-2 border-[#EAE4E2] bg-white py-2.5 pr-4 pl-10 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#2c3e50]"
              />
            </label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Tipo de asignatura">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  aria-pressed={filtro === f}
                  className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-extrabold transition-colors ${
                    filtro === f ? 'border-[#2c3e50] bg-[#2C3E50] text-white' : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2C3E50]'
                  }`}
                >
                  {f === 'TODAS' ? 'Todas' : CATEGORY_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          {!arbol && !error ? (
            <Estado>Cargando las asignaturas…</Estado>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Listado de asignaturas">
              {tarjetas.map(({ asignatura: a, cuenta, temasConMaterial, tieneGeneral }) => {
                const h = acierto.get(a.id)
                const guia = guiaDeAsignatura(a.id)
                const carpetas = temasConMaterial + (tieneGeneral ? 1 : 0)
                return (
                  <Link key={a.id} href={`/library/${a.id}`} className="group block h-full">
                    <StickerCard className="flex h-full flex-col gap-4 p-5 transition-transform group-hover:-translate-y-1" depth={4}>
                      <div className="flex items-start gap-3">
                        <Sigla asignatura={a} />
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-lg leading-tight font-black text-[#2C3E50] group-hover:text-[#C97D6F]">{a.nombre}</h3>
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
                          <CifrasPreguntas preguntas={null} acierto={h?.accuracy ?? null} respondidas={h?.total ?? 0} soloAcierto />
                        </div>
                      </div>
                    </StickerCard>
                  </Link>
                )
              })}
              {tarjetas.length === 0 && arbol ? <Estado>Nada con «{busca}».</Estado> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
