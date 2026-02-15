'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import LoginCard from './LoginCard'
import RegisterCard from './RegisterCard'
import RecoverCard from './RecoverCard'
import FallingBackground from './FallingBackground'
import { supabase } from '@/lib/supabaseBrowser'

export default function AuthCard({
  initialMode = 'login',
}: {
  initialMode?: 'login' | 'register' | 'recover'
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(
    initialMode
  )
  const loginRef = useRef<HTMLDivElement>(null)
  const registerRef = useRef<HTMLDivElement>(null)
  const recoverRef = useRef<HTMLDivElement>(null)
  const loginMeasureRef = useRef<HTMLDivElement>(null)
  const registerMeasureRef = useRef<HTMLDivElement>(null)
  const recoverMeasureRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const [pillX, setPillX] = useState<'0%' | '96%'>(
    initialMode === 'register' ? '96%' : '0%'
  )
  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  const measureActiveHeight = () => {
    const nextHeight =
      mode === 'login'
        ? loginMeasureRef.current?.offsetHeight
        : mode === 'register'
          ? registerMeasureRef.current?.offsetHeight
          : recoverMeasureRef.current?.offsetHeight
    if (nextHeight) {
      setPanelHeight(nextHeight)
    }
  }

  useLayoutEffect(() => {
    measureActiveHeight()
  }, [mode])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      measureActiveHeight()
    })
    const timeout = setTimeout(() => {
      measureActiveHeight()
    }, 100)
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(timeout)
    }
  }, [mode])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSessionEmail(data.session?.user.email ?? null)
      setCheckingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!checkingSession && sessionEmail) {
      router.replace('/dashboard')
    }
  }, [checkingSession, sessionEmail, router])

  const animatePill = (nextMode: 'login' | 'register') => {
    if (!pillRef.current || nextMode === mode) return
    const from = pillX
    const to = nextMode === 'register' ? '96%' : '0%'

    const anim = pillRef.current.animate(
      [
        { transform: `translateX(${from}) scaleX(1)` },
        { transform: `translateX(${to}) scaleX(1)`, offset: 0.6 },
        { transform: `translateX(${to}) scaleX(1)` },
      ],
      {
        duration: 900,
        easing: 'cubic-bezier(0.34,1.56,0.64,1)',
        fill: 'both',
      }
    )
    anim.onfinish = () => setPillX(to)
  }

  const switchMode = (nextMode: 'login' | 'register' | 'recover') => {
    if (nextMode === 'login' || nextMode === 'register') {
      animatePill(nextMode)
    }
    setMode(nextMode)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#FAF7F4] px-4 overflow-hidden">
      <FallingBackground />
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-[#171312]">
            MIRDaily
          </h1>
          <p className="mt-2 text-sm text-[#7D8A96]">
            {mode === 'recover'
              ? 'Recupera tu acceso'
              : mode === 'login'
                ? 'Bienvenido de nuevo'
                : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[#F0EAE6] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          {checkingSession ? (
            <p className="text-sm text-[#7D8A96]">Comprobando sesion...</p>
          ) : sessionEmail ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-[#F0EAE6] bg-[#FAF7F4] p-4">
                <p className="text-sm text-[#7D8A96]">Registro completado</p>
                <p className="mt-1 text-base font-semibold text-[#171312]">
                  Sesion iniciada
                </p>
                <p className="mt-1 text-sm text-[#7D8A96]">
                  {sessionEmail}
                </p>
              </div>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                }}
                className="h-12 w-full rounded-lg border border-[#E4DEDC] text-sm font-medium text-[#171312] hover:bg-[#FAF7F4]"
              >
                Cerrar sesion
              </button>
            </div>
          ) : (
            <>
              {/* Slider */}
              <div
                className={`relative flex rounded-lg bg-[#FAF7F4] overflow-hidden transition-all duration-300 ${
                  mode === 'recover'
                    ? 'opacity-0 pointer-events-none h-0 mb-0 p-0'
                    : 'opacity-100 h-auto mb-6 p-1'
                }`}
              >
                <div
                  ref={pillRef}
                  className="absolute top-1 bottom-1 w-1/2 rounded-md bg-white border border-[#F0EAE6] box-border will-change-transform transform-gpu"
                  style={{
                    transform: `translateX(${pillX})`,
                  }}
                />

                <button
                  onClick={() => {
                    switchMode('login')
                  }}
                  className={`relative z-10 flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
                    mode === 'login' ? 'text-[#171312]' : 'text-[#7D8A96]'
                  } cursor-pointer`}
                >
                  Iniciar sesion
                </button>

                <button
                  onClick={() => {
                    switchMode('register')
                  }}
                  className={`relative z-10 flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
                    mode === 'register'
                      ? 'text-[#171312]'
                      : 'text-[#7D8A96]'
                  } cursor-pointer`}
                >
                  Registrarse
                </button>
              </div>

              {/* Form (morph) */}
              <div
                className="relative overflow-hidden transition-[height] duration-700 ease-[cubic-bezier(0.7,0,0.3,1)]"
                style={
                  panelHeight ? { height: `${panelHeight}px` } : undefined
                }
              >
                <div
                  ref={loginRef}
                  className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
                    mode === 'login'
                      ? 'opacity-100 translate-x-0 scale-100 blur-0'
                      : mode === 'recover'
                        ? 'pointer-events-none opacity-0 translate-x-4 scale-[0.98] blur-sm'
                        : 'pointer-events-none opacity-0 translate-y-2 scale-[0.98] blur-sm'
                  }`}
                >
                  <div ref={loginMeasureRef}>
                    <LoginCard
                      onSwitch={() => switchMode('register')}
                      onRecover={() => switchMode('recover')}
                    />
                  </div>
                </div>

                <div
                  ref={registerRef}
                  className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
                    mode === 'register'
                      ? 'opacity-100 translate-x-0 scale-100 blur-0'
                      : mode === 'recover'
                        ? 'pointer-events-none opacity-0 translate-x-4 scale-[0.98] blur-sm'
                        : 'pointer-events-none opacity-0 translate-y-2 scale-[0.98] blur-sm'
                  }`}
                >
                  <div ref={registerMeasureRef}>
                    <RegisterCard onSwitch={() => switchMode('login')} />
                  </div>
                </div>

                <div
                  ref={recoverRef}
                  className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.7,0,0.3,1)] ${
                    mode === 'recover'
                      ? 'opacity-100 translate-x-0 scale-100 blur-0'
                      : 'pointer-events-none opacity-0 translate-x-4 scale-[0.98] blur-sm'
                  }`}
                >
                  <div ref={recoverMeasureRef}>
                    <div className="-mt-1">
                      <RecoverCard onBack={() => switchMode('login')} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
