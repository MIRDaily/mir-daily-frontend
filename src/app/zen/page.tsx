import Link from 'next/link'
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
  card: string
  icon: string
  badge: string
  cta: string
  studyBadge: string
  breakBadge: string
}> = {
  warm: {
    card: 'border-[#E8A598]/30 bg-gradient-to-br from-white to-[#fff5f2] hover:border-[#E8A598]/60',
    icon: 'bg-[#E8A598] text-white',
    badge: 'border-[#E8A598]/20 bg-[#E8A598]/10 text-[#d18d80]',
    cta: 'bg-[#E8A598] text-white shadow-md shadow-[#E8A598]/20 hover:bg-[#d18d80]',
    studyBadge: 'bg-[#E8A598]/10 text-[#d18d80]',
    breakBadge: 'bg-[#E8A598]/8 text-[#d18d80]/80',
  },
  green: {
    card: 'border-[#8BA888]/30 bg-gradient-to-br from-white to-[#f4f7f4] hover:border-[#8BA888]/60',
    icon: 'bg-[#8BA888] text-white',
    badge: 'border-[#8BA888]/20 bg-[#8BA888]/10 text-[#6a8a67]',
    cta: 'bg-[#8BA888] text-white shadow-md shadow-[#8BA888]/20 hover:bg-[#739970]',
    studyBadge: 'bg-[#8BA888]/10 text-[#6a8a67]',
    breakBadge: 'bg-[#8BA888]/8 text-[#6a8a67]/80',
  },
  muted: {
    card: 'border-[#EAE4E2] bg-white hover:border-[#7D8A96]/40',
    icon: 'bg-[#F2EFED] text-[#7D8A96]',
    badge: 'border-[#7D8A96]/20 bg-[#7D8A96]/10 text-[#7D8A96]',
    cta: 'bg-[#7D8A96] text-white shadow-md shadow-[#7D8A96]/15 hover:bg-[#6c7985]',
    studyBadge: 'bg-[#7D8A96]/10 text-[#7D8A96]',
    breakBadge: 'bg-[#7D8A96]/8 text-[#7D8A96]/70',
  },
}

export default function ZenLobbyPage() {
  debugRender('ZenLobbyPage')

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 [background-image:radial-gradient(circle_at_25%_25%,rgba(139,168,136,0.07)_0,transparent_35%),radial-gradient(circle_at_75%_70%,rgba(232,165,152,0.07)_0,transparent_35%)]" />
      <div className="pointer-events-none fixed -right-[8%] -top-[12%] z-0 h-80 w-80 rounded-full bg-[#8BA888]/12 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-[8%] -left-[8%] z-0 h-80 w-80 rounded-full bg-[#E8A598]/12 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 py-12">

        {/* Header section */}
        <section className="mb-12 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8BA888] to-[#739970] text-white shadow-lg shadow-[#8BA888]/25">
            <span className="material-symbols-outlined text-3xl">spa</span>
          </div>
          <h1 className="mb-3 text-4xl font-black tracking-tight text-[#2c3e50]">
            Sala Zen
          </h1>
          <p className="max-w-lg text-base font-light leading-relaxed text-[#7D8A96]">
            Un espacio de estudio compartido y tranquilo. Elige tu modo Pomodoro,
            entra en la sala y estudia junto a otros.
          </p>
        </section>

        {/* Preset cards */}
        <section className="mb-10">
          <h2 className="mb-6 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
            Elige tu modo de estudio
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {presets.map((preset) => {
              const styles = toneStyles[preset.tone]
              return (
                <article
                  key={preset.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${styles.card}`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`rounded-xl p-3 transition-transform duration-200 group-hover:scale-105 ${styles.icon}`}>
                      <span className="material-symbols-outlined text-2xl">{preset.icon}</span>
                    </div>
                    {preset.badge ? (
                      <span className={`rounded border px-2 py-1 text-xs font-bold ${styles.badge}`}>
                        {preset.badge}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mb-2 text-xl font-bold text-[#2c3e50]">{preset.title}</h3>
                  <p className="mb-5 flex-1 text-sm leading-relaxed">{preset.description}</p>

                  {/* Time badges */}
                  <div className="mb-5 flex gap-2">
                    <span className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${styles.studyBadge}`}>
                      <span className="material-symbols-outlined text-[14px]">school</span>
                      {preset.studyLabel}
                    </span>
                    <span className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${styles.breakBadge}`}>
                      <span className="material-symbols-outlined text-[14px]">coffee</span>
                      {preset.breakLabel}
                    </span>
                  </div>

                  <Link
                    href={`/zen/room?preset=${preset.slug}`}
                    className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${styles.cta}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">door_open</span>
                    Entrar a la sala
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        {/* Info strip */}
        <section className="rounded-2xl border border-[#EAE4E2] bg-white/60 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: 'group', label: 'Sala compartida', desc: 'Estudia junto a otros estudiantes MIR' },
              { icon: 'psychology', label: 'Avatares animados', desc: 'Personajes que reflejan tu estado de estudio' },
              { icon: 'timer', label: 'Sin interrupciones', desc: 'El temporizador guía cada ciclo automáticamente' },
            ].map((item) => (
              <div key={item.icon} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2EFED] text-[#7D8A96]">
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2c3e50]">{item.label}</p>
                  <p className="text-xs leading-snug text-[#7D8A96]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
