'use client'

/* ════════════════════════════════════════════════════════════════════════
   Buscador de la cabecera del Studio: icono → popover, mismo patrón que
   HeaderStreakButton/NotificationsPopup (el que abre se encarga del clic
   fuera y del Escape).

   Índice de dos fuentes: los módulos del propio Studio (fijos, con su ruta
   real) y las asignaturas de verdad (`fetchSubjects`, las mismas que usa el
   constructor de simulacros). Las asignaturas enlazan a /library en general
   y no a una vista filtrada: /library todavía corre sobre datos de ejemplo
   (`src/mocks/library.ts`), así que prometer un filtro exacto ahí mentiría
   más de lo que ayuda.
═══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSubjects } from '@/lib/simulacro/queries'
import type { Subject } from '@/lib/simulacro/types'

type ModuleItem = {
  key: string
  title: string
  sub: string
  icon: string
  href: string
}

const MODULES: ModuleItem[] = [
  { key: 'simulacros', title: 'Simulacros', sub: 'Preguntas y Simulacros', icon: 'quiz', href: '/studio/simulacro' },
  { key: 'mazos', title: 'Mazos', sub: 'Repaso espaciado', icon: 'layers', href: '/decks' },
  { key: 'flashcards', title: 'Flashcards', sub: 'Tarjetas propias', icon: 'style', href: '/flashcards' },
  { key: 'zen', title: 'Sala Zen', sub: 'Mindfulness', icon: 'self_improvement', href: '/zen' },
  { key: 'electros', title: 'Electros', sub: 'Academia de ECG', icon: 'monitor_heart', href: '/studio/electros' },
  { key: 'minijuegos', title: 'Minijuegos', sub: 'GramSwipe y más', icon: 'sports_esports', href: '/studio/minijuegos' },
  { key: 'biblioteca', title: 'Conceptos Básicos', sub: 'Biblioteca de manuales', icon: 'menu_book', href: '/library' },
]

function normalize(s: string): string {
  return s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function StudioSearchButton() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Las asignaturas se piden la primera vez que se abre, no al montar la
  // página: si nadie usa el buscador, no hace falta la petición.
  useEffect(() => {
    if (!open || subjects !== null) return
    fetchSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]))
  }, [open, subjects])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(id)
    }
    setQuery('')
  }, [open])

  const q = normalize(query.trim())
  const modules = useMemo(
    () => (q ? MODULES.filter((m) => normalize(m.title).includes(q)) : MODULES.slice(0, 4)),
    [q],
  )
  const subjectResults = useMemo(() => {
    const list = subjects ?? []
    return q ? list.filter((s) => normalize(s.name).includes(q)) : list.slice(0, 3)
  }, [q, subjects])

  const hasResults = modules.length > 0 || subjectResults.length > 0

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Buscar"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex size-10 items-center justify-center rounded-full border-2 border-white bg-white/90 shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-150 active:translate-y-0 active:scale-95 ${
          open
            ? 'text-[#d18d80] ring-2 ring-[#E8A598]/30'
            : 'text-[#7D8A96] hover:text-[#d18d80] hover:bg-[#FAF7F4] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(125,138,150,0.24),inset_0_1px_0_rgba(255,255,255,0.92)]'
        }`}
      >
        <span className="material-symbols-outlined text-[20px] leading-none">search</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Buscar en el Studio"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(90vw,21rem)] overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white shadow-[0_18px_40px_rgba(125,138,150,0.22)]"
        >
          <div className="border-b border-[#EAE4E2] p-3">
            <div className="flex items-center gap-2 rounded-xl bg-[#FAF7F4] px-3 py-2">
              <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Módulo o asignatura…"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#2c3e50] outline-none placeholder:font-light placeholder:text-[#a8b0b6]"
              />
              <kbd className="shrink-0 rounded border border-[#e6e2df] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#a8b0b6]">
                Esc
              </kbd>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-3 py-2">
            {!hasResults ? (
              <p className="py-6 text-center text-sm text-[#7D8A96]">Sin resultados para «{query}»</p>
            ) : (
              <>
                {modules.length > 0 ? (
                  <section className="pb-2">
                    <p className="px-1 pb-1.5 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                      {q ? 'Módulos' : 'Sugeridos'}
                    </p>
                    <ul className="space-y-0.5">
                      {modules.map((m) => (
                        <li key={m.key}>
                          <Link
                            href={m.href}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[#FAF7F4]"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f3ece7] text-[#d18d80]">
                              <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-[#2c3e50]">
                                {m.title}
                              </span>
                              <span className="block truncate text-[11px] text-[#9aa3ab]">{m.sub}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {subjectResults.length > 0 ? (
                  <section className="pb-2">
                    <p className="px-1 pb-1.5 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                      Asignaturas
                    </p>
                    <ul className="space-y-0.5">
                      {subjectResults.map((s) => (
                        <li key={s.id}>
                          <Link
                            href="/library"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[#FAF7F4]"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef1ec] text-[#6f8a6c]">
                              <span className="material-symbols-outlined text-[16px]">local_library</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-[#2c3e50]">
                                {s.name}
                              </span>
                              <span className="block truncate text-[11px] text-[#9aa3ab]">Biblioteca</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
