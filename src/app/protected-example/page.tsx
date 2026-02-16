'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function ProtectedExamplePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth')
    }
  }, [loading, router, user])

  if (loading) {
    return null
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] p-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#E9E4E1] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
        <h1 className="text-2xl font-bold text-[#2D3748]">Protected page</h1>
        <p className="mt-2 text-[#7D8A96]">
          Usuario autenticado: <span className="font-semibold">{user.email}</span>
        </p>
      </section>
    </main>
  )
}

