'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { LIBRARY_SUBJECT_OVERVIEWS } from '@/components/library/libraryMockData'
import LibraryFilters, { type LibraryFilterType } from '@/components/library/LibraryFilters'
import SubjectCard from '@/components/library/SubjectCard'

const BRAIN_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%237D8A96' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"

export default function LibraryPage() {
  const [query, setQuery] = useState('')
  const [activeType, setActiveType] = useState<LibraryFilterType>('TODAS')

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')

    return LIBRARY_SUBJECT_OVERVIEWS.filter((subject) => {
      const matchesType = activeType === 'TODAS' || subject.type === activeType
      const matchesQuery =
        normalizedQuery.length === 0 ||
        subject.name.toLocaleLowerCase('es').includes(normalizedQuery)
      return matchesType && matchesQuery
    })
  }, [activeType, query])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-6 py-8 text-[#7D8A96] antialiased">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40" style={{ backgroundImage: BRAIN_PATTERN }} />
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] z-0 h-96 w-96 rounded-full bg-[#E8A598]/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <section className="flex flex-col gap-2">
          <Link href="/dashboard" className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wider text-[#E8A598] uppercase">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Volver al Dashboard
          </Link>
          <h1 className="text-4xl font-black tracking-tight text-[#2C3E50]">Biblioteca de Asignaturas</h1>
          <p className="max-w-2xl text-lg font-light text-[#7D8A96]">
            Accede a todo el temario MIR organizado.{' '}
            <span className="font-medium text-[#d18d80]">{LIBRARY_SUBJECT_OVERVIEWS.length} asignaturas</span> actualizadas con IA predictiva.
          </p>
        </section>

        <LibraryFilters
          query={query}
          activeType={activeType}
          onQueryChange={setQuery}
          onTypeChange={setActiveType}
        />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Listado de asignaturas">
          {filteredSubjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </section>
      </div>
    </main>
  )
}
