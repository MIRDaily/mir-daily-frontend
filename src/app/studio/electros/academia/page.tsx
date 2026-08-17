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
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] antialiased sm:px-6">
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] z-0 h-96 w-96 rounded-full bg-[#E8A598]/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/10 blur-3xl" />
      <div className="relative z-10">
        <AcademiaClient />
      </div>
    </main>
  )
}
