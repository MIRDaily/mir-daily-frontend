import { Suspense } from 'react'
import ZenRoomClient from './ZenRoomClient'

export const metadata = {
  title: 'Sala Zen · MIRDaily',
}

function ZenRoomFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F4]">
      <div className="flex flex-col items-center gap-3 text-[#7D8A96]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#EAE4E2] border-t-[#E8A598]" />
        <span className="text-sm font-medium">Preparando la sala…</span>
      </div>
    </div>
  )
}

export default function ZenRoomPage() {
  return (
    <Suspense fallback={<ZenRoomFallback />}>
      <ZenRoomClient />
    </Suspense>
  )
}
