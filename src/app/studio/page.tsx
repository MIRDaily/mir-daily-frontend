import Link from 'next/link'

type QuickStat = {
  label: string
  value: string
  icon: string
  iconClass: string
}

type OverviewCard = {
  title: string
  value: string
  badge?: string
  description: string
  icon: string
  tone: 'success' | 'error'
}

type StudioCard = {
  id: string
  icon: string
  title: string
  description: string
  type: 'featured' | 'split-actions' | 'progress' | 'zen'
  badge?: string
  cta?: string
  primaryAction?: string
  secondaryAction?: string
  progress?: number
  meta?: string
  linkOne?: string
  linkTwo?: string
}

const quickStats: ReadonlyArray<QuickStat> = [
  {
    label: 'Racha',
    value: '12 días',
    icon: 'local_fire_department',
    iconClass: 'bg-[#e6f4ea] text-[#8BA888]',
  },
  {
    label: 'Hoy',
    value: '4h 20m',
    icon: 'timer',
    iconClass: 'bg-[#feefc3] text-[#ea8600]',
  },
] as const

const overviewCards: ReadonlyArray<OverviewCard> = [
  {
    title: 'Progreso Mensual',
    value: '+182',
    badge: '↑ +5.2%',
    description: '15.678 preguntas/flashcards realizadas en el último año',
    icon: 'trending_up',
    tone: 'success',
  },
  {
    title: 'Punto Débil Detectado',
    value: 'Digestivo',
    description: 'Precisión baja en patología esofágica (45%).',
    icon: 'priority_high',
    tone: 'error',
  },
] as const

const studioCards: ReadonlyArray<StudioCard> = [
  {
    id: 'simulacros',
    icon: 'psychology_alt',
    title: 'Simulacro Inteligente',
    description:
      'IA Predictiva: Te sugerimos una sesión de 30 preguntas centrada en tus fallos recientes de Digestivo y Cardiología.',
    cta: 'Generar sesión personalizada',
    badge: 'RECOMENDADO',
    type: 'featured',
  },
  {
    id: 'preguntas-simulacros',
    icon: 'quiz',
    title: 'Preguntas y Simulacros',
    description: 'Crea nuevos simulacros, revisa tu historial o haz un test rápido.',
    primaryAction: 'Crear Simulacro',
    secondaryAction: 'Revisar Historial',
    type: 'split-actions',
  },
  {
    id: 'flashcards',
    icon: 'style',
    title: 'Mazos y Flashcards',
    description: 'Repaso espaciado activo para retener conceptos a largo plazo.',
    progress: 65,
    meta: 'META DIARIA (13/20)',
    linkOne: 'Continuar repaso',
    linkTwo: 'Ir a mis mazos',
    type: 'progress',
  },
  {
    id: 'sala-zen',
    icon: 'self_improvement',
    title: 'Sala Zen',
    description: 'Relajación y mindfulness para mejorar tu concentración.',
    primaryAction: 'Crear Sala',
    secondaryAction: 'Unirme',
    badge: 'LIVE',
    type: 'zen',
  },
] as const

export default function StudioPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Fondo decorativo */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(125,138,150,0.08)_0,transparent_30%),radial-gradient(circle_at_80%_75%,rgba(232,165,152,0.08)_0,transparent_30%)]" />
      <div className="pointer-events-none fixed -right-[5%] -top-[10%] z-0 h-96 w-96 rounded-full bg-[#E8A598]/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-[10%] -left-[5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/15 blur-3xl" />


      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-10">
          <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-black tracking-tight text-[#2c3e50]">Studio</h1>
              <p className="text-lg font-light">
                Vamos a por tu plaza, <span className="font-medium text-[#d18d80]">Alejandro</span>.
                Hoy es un buen día para avanzar.
              </p>
            </div>

            <div className="flex gap-4">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[#EAE4E2] bg-white px-5 py-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-1.5 ${stat.iconClass}`}>
                      <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide">{stat.label}</p>
                      <p className="text-base font-bold text-[#2c3e50]">{stat.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">dashboard</span>
              <h2 className="text-xl font-bold text-[#2c3e50]">Visión General del Estudio</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {overviewCards.map((card) => (
                <article
                  key={card.title}
                  className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div
                    className={`absolute right-0 top-0 h-full w-24 bg-gradient-to-l to-transparent ${
                      card.tone === 'success' ? 'from-[#8BA888]/12' : 'from-[#C4655A]/12'
                    }`}
                  />
                  <div className="relative z-10">
                    <span className="text-sm font-medium uppercase tracking-wider">{card.title}</span>
                    <div className="mt-2 flex items-baseline gap-3">
                      <p
                        className={`text-4xl font-black tracking-tight ${
                          card.tone === 'success' ? 'text-[#8BA888]' : 'text-[#2c3e50]'
                        }`}
                      >
                        {card.value}
                      </p>
                      {card.badge ? (
                        <span className="rounded-lg bg-[#8BA888]/10 px-2 py-0.5 text-sm font-bold text-[#8BA888]">
                          {card.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm">{card.description}</p>
                  </div>
                  <div
                    className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full ${
                      card.tone === 'success'
                        ? 'bg-[#8BA888]/10 text-[#8BA888]'
                        : 'bg-[#C4655A]/10 text-[#C4655A]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl">{card.icon}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {studioCards.map((card) => (
              <article
                key={card.id}
                id={card.id}
                className={`group relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
                  card.type === 'featured'
                    ? 'border-[#E8A598]/30 bg-gradient-to-br from-white to-[#fff0ec] md:col-span-2'
                    : card.type === 'zen'
                      ? 'border-[#EAE4E2] bg-[#f4f7f4]'
                      : 'border-[#EAE4E2] bg-white'
                }`}
              >
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div>
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div
                        className={`rounded-xl p-3 ${
                          card.type === 'featured'
                            ? 'bg-[#E8A598] text-white'
                            : card.type === 'zen'
                              ? 'bg-white text-[#8BA888]'
                              : 'bg-[#F2EFED] text-[#2c3e50]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-3xl">{card.icon}</span>
                      </div>
                      {card.badge ? (
                        <span
                          className={`rounded border px-2 py-1 text-xs font-bold ${
                            card.type === 'zen'
                              ? 'border-[#8BA888]/20 bg-[#8BA888]/10 text-[#8BA888]'
                              : 'border-[#E8A598]/20 bg-[#E8A598]/10 text-[#d18d80]'
                          }`}
                        >
                          {card.badge}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mb-2 text-2xl font-bold text-[#2c3e50]">{card.title}</h3>
                    <p className="mb-5 text-sm sm:text-base">{card.description}</p>
                  </div>

                  {card.type === 'featured' ? (
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-6 py-3 text-base font-medium text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] sm:w-auto">
                      <span className="material-symbols-outlined">play_arrow</span>
                      {card.cta}
                    </button>
                  ) : null}

                  {card.type === 'split-actions' ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button className="flex-1 rounded-xl bg-[#E8A598] px-4 py-3 text-base font-medium text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]">
                        {card.primaryAction}
                      </button>
                      <button className="flex-1 rounded-xl border border-[#7D8A96]/30 bg-white px-4 py-3 text-base font-medium transition-colors hover:border-[#7D8A96]/50 hover:bg-[#F2EFED]">
                        {card.secondaryAction}
                      </button>
                    </div>
                  ) : null}

                  {card.type === 'progress' ? (
                    <div>
                      <span className="mb-3 inline-block rounded border border-[#8BA888]/20 bg-[#8BA888]/10 px-2 py-1 text-xs font-bold text-[#8BA888]">
                        {card.meta}
                      </span>
                      <div className="mb-3">
                        <div className="mb-1 flex justify-end">
                          <span className="text-xs font-bold text-[#2c3e50]">{card.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-[#8BA888]" style={{ width: `${card.progress}%` }} />
                        </div>
                      </div>
                      <Link
                        className="mb-3 flex w-fit items-center gap-1 text-sm font-semibold text-[#E8A598] hover:underline"
                        href="/studio/mazos"
                      >
                        {card.linkOne}
                        <span className="material-symbols-outlined text-base">play_circle</span>
                      </Link>
                      <Link className="flex w-fit items-center gap-1 text-sm font-semibold hover:text-[#E8A598]" href="/studio/mazos">
                        {card.linkTwo}
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </Link>
                    </div>
                  ) : null}

                  {card.type === 'zen' ? (
                    <div className="flex flex-row gap-3">
                      <button className="flex-1 rounded-lg bg-[#E8A598] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80]">
                        {card.primaryAction}
                      </button>
                      <button className="flex-1 rounded-lg bg-[#7D8A96] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6c7985]">
                        {card.secondaryAction}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section className="border-t border-[#EAE4E2] pt-8">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider">Acceso Rápido</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <a
                href="#"
                className="group flex cursor-pointer items-center gap-4 rounded-xl border border-[#EAE4E2] bg-white p-4 transition-colors hover:border-[#E8A598]/50"
              >
                <div className="rounded-lg bg-[#F2EFED] p-2 text-[#7D8A96] transition-colors group-hover:bg-[#E8A598] group-hover:text-white">
                  <span className="material-symbols-outlined">menu_book</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#2c3e50]">Conceptos Básicos</h4>
                  <p className="text-xs">Biblioteca de manuales</p>
                </div>
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
