'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { debugRender } from '@/lib/debugRSC'

type ZenPresetCard = {
  id: string
  slug: string
  icon: string
  title: string
  studyLabel: string
  breakLabel: string
  description: string
  badge?: string
  tone: 'warm' | 'green' | 'muted'
}

/** Individual con bots, o sala compartida con gente real. */
type ZenCompany = 'solo' | 'shared'

const presets: ReadonlyArray<ZenPresetCard> = [
  {
    id: 'classic',
    slug: 'classic',
    icon: 'timer',
    title: 'Pomodoro Clásico',
    studyLabel: '25 min',
    breakLabel: '5 min',
    description: 'La técnica original. Ciclos cortos para mantener la concentración y evitar la fatiga mental.',
    badge: 'MÁS POPULAR',
    tone: 'warm',
  },
  {
    id: 'deep',
    slug: 'deep',
    icon: 'self_improvement',
    title: 'Estudio Profundo',
    studyLabel: '50 min',
    breakLabel: '10 min',
    description: 'Bloques largos para sesiones de estudio intenso. Ideal cuando necesitas entrar en modo de concentración total.',
    tone: 'green',
  },
  {
    id: 'custom',
    slug: 'custom',
    icon: 'tune',
    title: 'Personalizado',
    studyLabel: 'Tú decides',
    breakLabel: 'Tú decides',
    description: 'Ajusta los tiempos a tu ritmo. Configura la duración de estudio y descanso antes de entrar.',
    tone: 'muted',
  },
] as const

const toneStyles: Record<ZenPresetCard['tone'], {
  ring: string
  icon: string
  iconActive: string
  badge: string
  studyBadge: string
  breakBadge: string
}> = {
  warm: {
    ring: 'border-[#E8A598] bg-gradient-to-br from-white to-[#fff5f2] shadow-[0_0_0_3px_rgba(232,165,152,0.18)]',
    icon: 'bg-[#E8A598]/12 text-[#d18d80]',
    iconActive: 'bg-[#E8A598] text-white',
    badge: 'border-[#E8A598]/20 bg-[#E8A598]/10 text-[#d18d80]',
    studyBadge: 'bg-[#E8A598]/10 text-[#d18d80]',
    breakBadge: 'bg-[#E8A598]/8 text-[#d18d80]/80',
  },
  green: {
    ring: 'border-[#8BA888] bg-gradient-to-br from-white to-[#f4f7f4] shadow-[0_0_0_3px_rgba(139,168,136,0.18)]',
    icon: 'bg-[#8BA888]/12 text-[#6a8a67]',
    iconActive: 'bg-[#8BA888] text-white',
    badge: 'border-[#8BA888]/20 bg-[#8BA888]/10 text-[#6a8a67]',
    studyBadge: 'bg-[#8BA888]/10 text-[#6a8a67]',
    breakBadge: 'bg-[#8BA888]/8 text-[#6a8a67]/80',
  },
  muted: {
    ring: 'border-[#7D8A96] bg-white shadow-[0_0_0_3px_rgba(125,138,150,0.15)]',
    icon: 'bg-[#F2EFED] text-[#7D8A96]',
    iconActive: 'bg-[#7D8A96] text-white',
    badge: 'border-[#7D8A96]/20 bg-[#7D8A96]/10 text-[#7D8A96]',
    studyBadge: 'bg-[#7D8A96]/10 text-[#7D8A96]',
    breakBadge: 'bg-[#7D8A96]/8 text-[#7D8A96]/70',
  },
}

// Sin caracteres ambiguos: nadie tiene que adivinar si es un cero o una O al
// dictar el código por WhatsApp.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5

function makeRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
}

export default function ZenLobbyPage() {
  debugRender('ZenLobbyPage')
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const [company, setCompany] = useState<ZenCompany>('solo')
  const [presetSlug, setPresetSlug] = useState('classic')
  const [joinCode, setJoinCode] = useState('')

  const selectedPreset = useMemo(
    () => presets.find((p) => p.slug === presetSlug) ?? presets[0],
    [presetSlug],
  )

  const canJoin = joinCode.length === CODE_LENGTH

  function enterSolo() {
    router.push(`/zen/room?preset=${presetSlug}&mode=solo`)
  }

  function enterPublic() {
    router.push(`/zen/room?preset=${presetSlug}&mode=public`)
  }

  function createPrivate() {
    router.push(`/zen/room?preset=${presetSlug}&mode=private&code=${makeRoomCode()}&host=1`)
  }

  function joinPrivate() {
    if (!canJoin) return
    router.push(`/zen/room?mode=private&code=${joinCode}`)
  }

  const fade = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.22, ease: 'easeOut' as const },
      }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Fondo decorativo */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 [background-image:radial-gradient(circle_at_25%_25%,rgba(139,168,136,0.07)_0,transparent_35%),radial-gradient(circle_at_75%_70%,rgba(232,165,152,0.07)_0,transparent_35%)]" />
      <div className="pointer-events-none fixed -right-[8%] -top-[12%] z-0 h-80 w-80 rounded-full bg-[#8BA888]/12 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-[8%] -left-[8%] z-0 h-80 w-80 rounded-full bg-[#E8A598]/12 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 py-12">
        <section className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8BA888] to-[#739970] text-white shadow-lg shadow-[#8BA888]/25">
            <span className="material-symbols-outlined text-3xl">spa</span>
          </div>
          <h1 className="mb-3 text-4xl font-black tracking-tight text-[#2c3e50]">Sala Zen</h1>
          <p className="max-w-lg text-base font-light leading-relaxed">
            Un espacio de estudio tranquilo. Elige con quién estudias, tu ritmo Pomodoro y entra.
          </p>
        </section>

        {/* Paso 1 · con quién */}
        <section className="mb-10">
          <StepLabel n={1} text="¿Con quién estudias?" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CompanyOption
              active={company === 'solo'}
              onSelect={() => setCompany('solo')}
              icon="person"
              title="Yo solo"
              description="La sala se llena de compañeros simulados. Sin conexión ni esperas."
            />
            <CompanyOption
              active={company === 'shared'}
              onSelect={() => setCompany('shared')}
              icon="groups"
              title="Con gente"
              description="Compartes sala, temporizador y un chat que desaparece al cerrarla."
            />
          </div>
        </section>

        {/* Paso 2 · ritmo */}
        <section className="mb-10">
          <StepLabel n={2} text="Elige tu ritmo" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {presets.map((preset) => {
              const styles = toneStyles[preset.tone]
              const active = preset.slug === presetSlug
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetSlug(preset.slug)}
                  aria-pressed={active}
                  className={`group relative flex flex-col rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    active ? styles.ring : 'border-[#EAE4E2] bg-white/70 hover:border-[#7D8A96]/30'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div
                      className={`rounded-xl p-2.5 transition-colors duration-200 ${
                        active ? styles.iconActive : styles.icon
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl">{preset.icon}</span>
                    </div>
                    {preset.badge ? (
                      <span className={`rounded border px-2 py-1 text-[10px] font-bold ${styles.badge}`}>
                        {preset.badge}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mb-1.5 text-lg font-bold text-[#2c3e50]">{preset.title}</h3>
                  <p className="mb-4 flex-1 text-sm leading-relaxed">{preset.description}</p>

                  <div className="flex gap-2">
                    <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${styles.studyBadge}`}>
                      <span className="material-symbols-outlined text-[14px]">school</span>
                      {preset.studyLabel}
                    </span>
                    <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${styles.breakBadge}`}>
                      <span className="material-symbols-outlined text-[14px]">coffee</span>
                      {preset.breakLabel}
                    </span>
                  </div>

                  {active ? (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2c3e50] text-white">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        {/* Paso 3 · entrar */}
        <section>
          <StepLabel n={3} text="Entrar" />
          <AnimatePresence mode="wait" initial={false}>
            {company === 'solo' ? (
              <motion.div key="solo" {...fade} className="rounded-2xl border border-[#EAE4E2] bg-white p-6">
                <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-base font-bold text-[#2c3e50]">
                      Sala individual · {selectedPreset.title}
                    </p>
                    <p className="mt-1 text-sm">
                      Estudias acompañado de personajes simulados. Nada se comparte con nadie.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={enterSolo}
                    className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#8BA888] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#8BA888]/20 transition-colors hover:bg-[#739970] sm:w-auto"
                  >
                    <span className="material-symbols-outlined text-[18px]">door_open</span>
                    Entrar a la sala
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="shared" {...fade} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Sala abierta */}
                <div className="flex flex-col rounded-2xl border border-[#EAE4E2] bg-white p-6">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8BA888]/12 text-[#6a8a67]">
                      <span className="material-symbols-outlined text-[20px]">public</span>
                    </span>
                    <h3 className="text-base font-bold text-[#2c3e50]">Sala abierta</h3>
                  </div>
                  <p className="mb-5 flex-1 text-sm leading-relaxed">
                    Entra a la sala pública de <strong className="font-semibold text-[#2c3e50]">{selectedPreset.title}</strong> y
                    estudia con quien esté dentro en ese momento.
                  </p>
                  <button
                    type="button"
                    onClick={enterPublic}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#8BA888] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#8BA888]/20 transition-colors hover:bg-[#739970]"
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    Entrar a la sala abierta
                  </button>
                </div>

                {/* Sala privada */}
                <div className="flex flex-col rounded-2xl border border-[#EAE4E2] bg-white p-6">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8A598]/12 text-[#d18d80]">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </span>
                    <h3 className="text-base font-bold text-[#2c3e50]">Sala privada</h3>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed">
                    Crea una sala y comparte el código, o entra en la de alguien.
                  </p>

                  <button
                    type="button"
                    onClick={createPrivate}
                    className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Crear sala privada
                  </button>

                  <div className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-[#7D8A96]/60">
                    <span className="h-px flex-1 bg-[#EAE4E2]" />o entra con código<span className="h-px flex-1 bg-[#EAE4E2]" />
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      joinPrivate()
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                      placeholder="A7K2M"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Código de sala"
                      className="w-full rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-[#2c3e50] placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-[#7D8A96]/35 focus:border-[#E8A598] focus:outline-none focus:ring-2 focus:ring-[#E8A598]/20"
                    />
                    <button
                      type="submit"
                      disabled={!canJoin}
                      className="shrink-0 rounded-xl border border-[#7D8A96]/30 px-4 py-3 text-sm font-semibold transition-colors enabled:hover:border-[#7D8A96]/50 enabled:hover:bg-[#F2EFED] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Unirme
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  )
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2c3e50] text-[11px] font-bold text-white">
        {n}
      </span>
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#7D8A96]/80">{text}</h2>
    </div>
  )
}

function CompanyOption({
  active,
  onSelect,
  icon,
  title,
  description,
}: {
  active: boolean
  onSelect: () => void
  icon: string
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? 'border-[#2c3e50] bg-white shadow-[0_0_0_3px_rgba(44,62,80,0.10)]'
          : 'border-[#EAE4E2] bg-white/70 hover:border-[#7D8A96]/30'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
          active ? 'bg-[#2c3e50] text-white' : 'bg-[#F2EFED] text-[#7D8A96]'
        }`}
      >
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold text-[#2c3e50]">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed">{description}</span>
      </span>
    </button>
  )
}
