'use client'

import type { SubjectType } from '@/types/library'

export type LibraryFilterType = 'TODAS' | SubjectType

type LibraryFiltersProps = {
  query: string
  activeType: LibraryFilterType
  onQueryChange: (value: string) => void
  onTypeChange: (value: LibraryFilterType) => void
}

const FILTER_BUTTONS: ReadonlyArray<{
  value: LibraryFilterType
  label: string
}> = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'MÉDICA', label: 'Médicas' },
  { value: 'QUIRÚRGICA', label: 'Quirúrgicas' },
  { value: 'BÁSICA', label: 'Básicas' },
]

export default function LibraryFilters({
  query,
  activeType,
  onQueryChange,
  onTypeChange,
}: LibraryFiltersProps) {
  return (
    <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#EAE4E2] bg-white p-4 shadow-sm md:flex-row">
      <div className="relative w-full md:w-1/3">
        <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#7D8A96]">
          filter_list
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filtrar por nombre de asignatura..."
          className="w-full rounded-xl border border-[#EAE4E2] bg-[#F9F8F7] py-2.5 pr-4 pl-10 text-sm text-[#2C3E50] outline-none transition-all placeholder:text-[#7D8A96]/60 focus:border-[#E8A598] focus:ring-2 focus:ring-[#E8A598]/50"
        />
      </div>

      <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-2 md:w-auto md:pb-0">
        {FILTER_BUTTONS.map((filter) => {
          const isActive = activeType === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onTypeChange(filter.value)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#2C3E50] text-white shadow-md'
                  : 'border border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#E8A598]/50 hover:text-[#E8A598] hover:shadow-sm'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
