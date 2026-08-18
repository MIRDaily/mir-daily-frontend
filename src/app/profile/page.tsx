'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProfileCard from '@/components/Profile/ProfileCard'
import { getOnboardingDeferredFlag } from '@/lib/onboarding'

export default function ProfilePage() {
  const router = useRouter()

  useEffect(() => {
    if (getOnboardingDeferredFlag()) {
      router.replace('/onboarding')
    }
  }, [router])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Ambiente: el guilloche del carné, muy tenue, y los halos de marca —
          mismo recurso que la trama de renglones de Flashcards. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-70"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(56deg, rgba(232,165,152,0.07) 0 1px, transparent 1px 14px)',
            'repeating-linear-gradient(-56deg, rgba(125,138,150,0.05) 0 1px, transparent 1px 14px)',
          ].join(','),
        }}
      />
      <div className="pointer-events-none fixed top-[-14%] right-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/12 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-14%] left-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#7BA7C4]/10 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 py-8 sm:px-6">
        <ProfileCard />
      </main>
    </div>
  )
}
