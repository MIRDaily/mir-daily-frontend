'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

export default function LoginCard({
  onSwitch,
  onRecover,
}: {
  onSwitch: () => void
  onRecover: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState<
    'google' | 'apple' | null
  >(null)

  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          setLoading(true)
          const { error: authError } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            })
          if (authError) {
            setError(authError.message)
          }
          setLoading(false)
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

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-lg border border-[#E4DEDC] px-3 pr-11 text-sm focus:border-[#E8A598] focus:outline-none focus:ring-2 focus:ring-[#E8A598]/20"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-[#7D8A96] hover:text-[#E8A598] cursor-pointer"
            aria-label={
              showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'
            }
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>

        {error ? (
          <p className="text-sm text-[#C4655A]">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-lg bg-[#E8A598] text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Entrando...' : 'Iniciar sesion'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#F0EAE6]"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-[#7D8A96] font-medium">
            o continúa con
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={async () => {
            setError(null)
            setOauthLoading('google')
            const { error: authError } =
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              })
            if (authError) {
              setError('Error al conectar con Google')
            }
            setOauthLoading(null)
          }}
          disabled={oauthLoading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#E4DEDC] rounded-xl bg-white hover:bg-[#FAF7F4] transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-sm font-semibold text-[#2D3748]">
            {oauthLoading === 'google' ? 'Conectando...' : 'Google'}
          </span>
        </button>
        <button
          type="button"
          onClick={async () => {
            setError(null)
            setOauthLoading('apple')
            const { error: authError } =
              await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              })
            if (authError) {
              setError(
                'Error al conectar con Apple (requiere configuracion)'
              )
            }
            setOauthLoading(null)
          }}
          disabled={oauthLoading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#E4DEDC] rounded-xl bg-white hover:bg-[#FAF7F4] transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.05 20.28c-.96 0-2.04-.68-3.32-.68-1.29 0-2.26.66-3.12.66-.96 0-1.87-.5-2.58-1.35-1.42-1.74-2.11-4.9-1.25-7.38.43-1.24 1.54-2.02 2.76-2.02.93 0 1.76.54 2.4.54.58 0 1.57-.65 2.7-.65 1.14 0 2.22.51 2.91 1.41-2.73 1.46-2.27 5.05.47 6.27-.61 1.41-1.45 2.87-2.61 3.2-.14.04-.26.06-.36.06zM13.23 6.94c0-2.31 1.88-4.22 4.19-4.22.18 0 .36.01.53.04-.12 2.38-1.92 4.26-4.24 4.26-.17 0-.34-.01-.48-.08z" />
          </svg>
          <span className="text-sm font-semibold text-[#2D3748]">
            {oauthLoading === 'apple' ? 'Conectando...' : 'Apple'}
          </span>
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-center text-sm text-[#7D8A96]">
        <button
          type="button"
          onClick={onRecover}
          className="underline cursor-pointer"
        >
          Olvidaste tu contrasena?
        </button>
        <p>
          No tienes cuenta?{' '}
          <button
            onClick={onSwitch}
            className="font-medium text-[#E8A598] underline cursor-pointer"
          >
            Crear cuenta
          </button>
        </p>
      </div>
    </>
  )
}
