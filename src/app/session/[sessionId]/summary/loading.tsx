'use client'

import GooFissionLoader from '@/components/studio/GooFissionLoader'
import { StickerCard, trackerBackdropStyle } from '@/components/studio/deckUi'

export default function StudioSessionSummaryLoading() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4]">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-70" style={trackerBackdropStyle()} />
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-5 py-8 sm:px-6">
        <StickerCard
          as="section"
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-10 text-center"
          depth={5}
        >
          <GooFissionLoader size={100} label="Cargando resumen" showGlow={false} />
          <p className="text-sm font-bold text-[#2C3E50]">Cargando resumen…</p>
        </StickerCard>
      </main>
    </div>
  )
}
