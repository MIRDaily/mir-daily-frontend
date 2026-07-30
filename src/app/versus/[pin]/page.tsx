import { notFound } from 'next/navigation'
import VersusRoom from '@/components/versus/VersusRoom'
import { debugRender } from '@/lib/debugRSC'

type VersusRoomPageProps = {
  params: Promise<{ pin: string }>
}

const PIN_RE = /^[A-Z0-9]{6}$/

export default async function VersusRoomPage({ params }: VersusRoomPageProps) {
  debugRender('VersusRoomPage')

  const { pin } = await params
  const normalized = pin.toUpperCase()

  // Un PIN con forma inválida no llega ni a pedirse al backend.
  if (!PIN_RE.test(normalized)) notFound()

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 [background-image:radial-gradient(circle_at_25%_25%,rgba(232,165,152,0.08)_0,transparent_35%),radial-gradient(circle_at_75%_70%,rgba(125,138,150,0.07)_0,transparent_35%)]" />
      <div className="pointer-events-none fixed -right-[8%] -top-[12%] z-0 h-80 w-80 rounded-full bg-[#E8A598]/12 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-[8%] -left-[8%] z-0 h-80 w-80 rounded-full bg-[#7D8A96]/12 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 py-12">
        <VersusRoom pin={normalized} />
      </main>
    </div>
  )
}
