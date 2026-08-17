'use client'

import { useEffect } from 'react'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import ExploradorClient from '@/components/electros/ExploradorClient'

export default function ExploradorPage() {
  const { setBackAction } = useHeaderUI()

  useEffect(() => {
    setBackAction({ label: 'Electros', href: '/studio/electros' })
    return () => setBackAction(null)
  }, [setBackAction])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] antialiased sm:px-6">
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] z-0 h-96 w-96 rounded-full bg-[#E8A598]/10 blur-3xl" />
      <ExploradorClient />
    </main>
  )
}
