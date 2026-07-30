'use client'

import Link from 'next/link'
import GramSwipeGame from '@/components/minijuegos/gramswipe/GramSwipeGame'

export default function GramSwipePage() {
  return (
    <main className="min-h-screen bg-[#FAF7F4]">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 pt-6 md:px-6">
        <Link
          href="/studio/minijuegos"
          className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[#E8A598] uppercase"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Minijuegos
        </Link>
      </div>
      <GramSwipeGame />
    </main>
  )
}
