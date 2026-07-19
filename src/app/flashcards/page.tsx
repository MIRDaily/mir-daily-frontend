'use client'

// Página independiente de Flashcards (acceso propio desde Studio, al mismo nivel
// que Mazos y Simulacros). El listado/creación de grupos vive en el componente
// autocontenido FlashcardDecksSection; cada grupo enlaza a /flashcards/[deckId].

import { useEffect, useState } from 'react'
import Link from 'next/link'
import FlashcardDecksSection from '@/components/studio/FlashcardDecksSection'
import { supabase } from '@/lib/supabaseBrowser'

export default function FlashcardsPage() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-session'>('loading')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      const accessToken = session?.access_token ?? ''
      if (!accessToken) {
        setStatus('no-session')
        return
      }
      setToken(accessToken)
      setStatus('ready')
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="relative mb-8 flex items-center gap-3">
          <Link
            href="/studio"
            aria-label="Volver a studio"
            title="Volver a studio"
            className="inline-flex h-9 min-w-[52px] items-center justify-center rounded-lg bg-[#8BA888] text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BA888]/60 xl:absolute xl:-left-32 xl:top-1"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M19 12H5" />
              <path d="M11 18l-6-6 6-6" />
            </svg>
          </Link>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Studio</p>
        </section>

        {status === 'loading' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-[#EAE4E2] bg-white/60" />
            ))}
          </div>
        ) : status === 'no-session' ? (
          <p className="rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
            No hay sesión activa. Inicia sesión para ver tus flashcards.
          </p>
        ) : (
          <FlashcardDecksSection token={token} />
        )}
      </main>
    </div>
  )
}
