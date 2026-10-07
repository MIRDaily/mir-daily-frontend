'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getMap, type MapRecord } from '@/lib/mapas/api'

// El editor (React Flow + su CSS) solo se descarga al abrir un mapa, no en la lista.
const MapEditor = dynamic(() => import('@/components/mapas/MapEditor'), {
  ssr: false,
  loading: () => <Centered>Cargando editor…</Centered>,
})

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm font-medium text-[#7D8A96]">{children}</div>
  )
}

export default function MapaPage() {
  const params = useParams<{ mapId: string }>()
  const mapId = params.mapId
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; map: MapRecord }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    getMap(mapId)
      .then((map) => {
        if (cancelled) return
        setState(map ? { kind: 'ready', map } : { kind: 'missing' })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Error desconocido' })
      })
    return () => {
      cancelled = true
    }
  }, [mapId])

  return (
    <main className="w-full bg-[#FAF7F4]" style={{ height: "100dvh" }}>
      {state.kind === 'loading' && <Centered>Cargando mapa…</Centered>}
      {state.kind === 'missing' && (
        <Centered>
          <div className="text-center">
            <p className="mb-3 text-lg font-bold text-[#2C3E50]">No encontramos este mapa</p>
            <Link href="/mapas" className="font-bold text-[#E8A598]">
              Volver a mis mapas
            </Link>
          </div>
        </Centered>
      )}
      {state.kind === 'error' && <Centered>No se pudo cargar el mapa: {state.message}</Centered>}
      {state.kind === 'ready' && (
        <MapEditor key={state.map.id} mapId={state.map.id} initialTitle={state.map.title} rawDoc={state.map.doc} />
      )}
    </main>
  )
}
