'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { PRACTICE_MAP, PRACTICE_TITLE } from '@/lib/mapas/tutorial/practiceMap'
import { TUTORIAL_FIT } from '@/components/mapas/tutorial/layout'

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


function TutorialEditor() {
  const params = useSearchParams()
  const startAt = Math.max(0, Number(params.get('leccion') ?? 0) || 0)
  return (
    <MapEditor
      mapId="tutorial"
      initialTitle={PRACTICE_TITLE}
      rawDoc={PRACTICE_MAP}
      sandbox
      fitOptions={TUTORIAL_FIT}
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
