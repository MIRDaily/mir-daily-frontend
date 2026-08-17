'use client'

import { useEffect } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import AcademiaClient from '@/components/electros/AcademiaClient'

export default function AcademiaPage() {
  const { setBackAction } = useHeaderUI()

  useEffect(() => {
    setBackAction({ label: 'Electros', href: '/studio/electros' })
    return () => setBackAction(null)
  }, [setBackAction])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] antialiased sm:px-6 lg:px-8">
      {/* Ambiente: cuadrícula muy tenue de papel de ECG + halos de marca */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.55]"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(to right, rgba(212,151,140,0.09) 0 1px, transparent 1px 26px)',
            'repeating-linear-gradient(to bottom, rgba(212,151,140,0.09) 0 1px, transparent 1px 26px)',
          ].join(','),
        }}
      />
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] z-0 h-[28rem] w-[28rem] rounded-full bg-[#E8A598]/15 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-12%] left-[-8%] z-0 h-[28rem] w-[28rem] rounded-full bg-[#8BA888]/15 blur-3xl" />

      <div className="relative z-10">
        <AcademiaClient />
      </div>
    </main>
  )
}
