'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

export default function RecoverCard({
  onBack,
}: {
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black tracking-tight text-[#171312]">
          Recuperar acceso
        </h2>
        <p className="mt-2 text-sm text-[#7D8A96]">
          Te enviaremos un enlace para restablecer tu contrasena.
        </p>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          setSuccess(null)
          setLoading(true)
          try {
            const { error: authError } =
              await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset`,
              })
            if (authError) {
              setError(authError.message)
              return
            }
            setSuccess('Revisa tu correo para continuar.')
          } finally {
            setLoading(false)
          }
        }}
        className="flex flex-col gap-4"
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-lg border border-[#E4DEDC] px-3 text-sm focus:border-[#E8A598] focus:outline-none focus:ring-2 focus:ring-[#E8A598]/20"
          required
        />

        {error ? (
          <p className="text-sm text-[#C4655A]">{error}</p>
        ) : null}
        {success ? (
          <p className="text-sm text-[#8BA888]">{success}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-lg bg-[#E8A598] text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Enviando...' : 'Enviar enlace'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[#7D8A96]">
        Ya la recordaste?{' '}
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-[#E8A598] underline cursor-pointer"
        >
          Volver a iniciar sesion
        </button>
      </p>
    </div>
  )
}
