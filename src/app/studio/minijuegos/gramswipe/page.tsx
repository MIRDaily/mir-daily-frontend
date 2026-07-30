'use client'

import Link from 'next/link'

export default function GramSwipePage() {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#FAF7F4]">
      <div className="flex items-center gap-4 border-b border-[#EAE4E2] bg-white px-4 py-3">
        <Link
          href="/studio/minijuegos"
          className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[#E8A598] uppercase"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Minijuegos
        </Link>
        <span className="text-sm font-bold text-[#2C3E50]">GramSwipe</span>
      </div>
      <iframe
        src="/games/gramswipe/index.html"
        title="GramSwipe — Clasificación de antibióticos por espectro"
        className="w-full flex-1 border-0"
      />
    </main>
  )
}
