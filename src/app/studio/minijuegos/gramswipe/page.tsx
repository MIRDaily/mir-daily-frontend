'use client'

import { useEffect, useState } from 'react'
import GramSwipeGame, { type ScreenName } from '@/components/minijuegos/gramswipe/GramSwipeGame'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

export default function GramSwipePage() {
  const { setBackAction } = useHeaderUI()
  // Mientras hay una partida en curso ('game'), el propio juego ya muestra su
  // botón de volver con confirmación (protege el progreso). Quitamos el back
  // del header global en ese momento para no tener dos botones de retroceso
  // a la vez, uno de los cuales saldría de la página sin avisar.
  const [gameScreen, setGameScreen] = useState<ScreenName>('start')

  useEffect(() => {
    setBackAction(
      gameScreen === 'game' ? null : { label: 'Minijuegos', href: '/studio/minijuegos', current: 'GramSwipe' },
    )
    return () => setBackAction(null)
  }, [gameScreen, setBackAction])

  return (
    <main className="min-h-screen bg-[#FAF7F4]">
      <GramSwipeGame onScreenChange={setGameScreen} />
    </main>
  )
}
