'use client'

import { useState } from 'react'
import Link from 'next/link'
import GramSwipeGame, { type ScreenName } from '@/components/minijuegos/gramswipe/GramSwipeGame'

export default function GramSwipePage() {
  // Mientras hay una partida en curso ('game'), el propio juego ya muestra su
  // botón de volver con confirmación (protege el progreso). Ocultamos este
  // enlace de cabecera en ese momento para no tener dos botones de retroceso
  // a la vez, uno de los cuales saldría de la página sin avisar.
  const [gameScreen, setGameScreen] = useState<ScreenName>('start')

  return (
    <main className="min-h-screen bg-[#FAF7F4]">
      {gameScreen !== 'game' && (
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 pt-6 md:px-6">
          <Link
            href="/studio/minijuegos"
            className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[#E8A598] uppercase"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Minijuegos
          </Link>
        </div>
      )}
      <GramSwipeGame onScreenChange={setGameScreen} />
    </main>
  )
}
