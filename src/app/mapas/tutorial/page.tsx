'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { PRACTICE_MAP, PRACTICE_TITLE } from '@/lib/mapas/tutorial/practiceMap'
import { COACH_WIDTH } from '@/components/mapas/tutorial/layout'

// Tutorial interactivo de los mapas: el editor de verdad con un mapa de práctica que no se guarda
// y el entrenador de la mascota encima. Accesible siempre desde /mapas y desde el panel de atajos
// del editor; ?leccion=N empieza en esa lección.

const MapEditor = dynamic(() => import('@/components/mapas/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm font-medium text-[#7D8A96]">Preparando el tutorial…</div>
  ),
})

const MapTutorialCoach = dynamic(
  () => import('@/components/mapas/tutorial/MapTutorialCoach').then((m) => m.MapTutorialCoach),
  { ssr: false },
)

// El mapa se encuadra a la derecha del panel de la mascota (columna izquierda).
// En px y como texto: un número suelto React Flow lo toma como fracción (110 = 11 000 %).
const FIT_PADDING = { top: '110px', right: '48px', bottom: '48px', left: `${COACH_WIDTH + 56}px` } as const

function TutorialEditor() {
  const params = useSearchParams()
  const startAt = Math.max(0, Number(params.get('leccion') ?? 0) || 0)
  return (
    <MapEditor
      mapId="tutorial"
      initialTitle={PRACTICE_TITLE}
      rawDoc={PRACTICE_MAP}
      sandbox
      fitPadding={FIT_PADDING}
      overlay={<MapTutorialCoach startAt={startAt} />}
    />
  )
}

export default function MapasTutorialPage() {
  return (
    <main className="w-full bg-[#FAF7F4]" style={{ height: '100dvh' }}>
      <Suspense fallback={null}>
        <TutorialEditor />
      </Suspense>
    </main>
  )
}
