import VersusEntry from '@/components/versus/VersusEntry'
import { debugRender } from '@/lib/debugRSC'

type VersusModeCard = {
  id: string
  icon: string
  title: string
  description: string
  meta: string
  tone: 'warm' | 'blue' | 'muted'
}

// Los modos que se van a construir sobre el mismo motor de sala: cada uno es un
// conjunto de reglas (selección, puntuación, revelado), no una pantalla aparte.
const modes: ReadonlyArray<VersusModeCard> = [
  {
    id: 'duelo',
    icon: 'swords',
    title: 'Duelo',
    description:
      'Uno contra uno, mismas preguntas y mismo reloj. Ves qué ha elegido tu rival antes de que se destape la correcta.',
    meta: '2 jugadores · en directo',
    tone: 'warm',
  },
  {
    id: 'numero-de-orden',
    icon: 'trending_up',
    title: 'Número de orden',
    description:
      'Se puntúa con la fórmula real del MIR (+3 / −1 / 0) y el marcador no muestra puntos: muestra tu puesto y tu percentil en la sala.',
    meta: 'Hasta 40 jugadores',
    tone: 'warm',
  },
  {
    id: 'guardia',
    icon: 'bolt',
    title: 'Guardia',
    description:
      'Supervivencia. Quien falla, cae. El último en pie gana la guardia y los eliminados se quedan viendo caer al resto.',
    meta: 'Partidas cortas',
    tone: 'blue',
  },
  {
    id: 'ojo-clinico',
    icon: 'visibility',
    title: 'Ojo clínico',
    description:
      'Solo la imagen, sin enunciado y con diez segundos. Radiografías, fondos de ojo y lesiones cutáneas a contrarreloj.',
    meta: 'Preguntas con imagen',
    tone: 'blue',
  },
  {
    id: 'diagnostico-progresivo',
    icon: 'timeline',
    title: 'Diagnóstico progresivo',
    description:
      'El caso clínico se revela por fragmentos. Cuantas menos pistas necesites para acertar, más puntúa la respuesta.',
    meta: 'En diseño',
    tone: 'muted',
  },
  {
    id: 'reto-asincrono',
    icon: 'schedule',
    title: 'Reto asíncrono',
    description:
      'Sin cuadrar horarios: juegas tu tanda, tu rival juega las mismas preguntas cuando pueda y se comparan los resultados.',
    meta: 'Sin coincidir en el tiempo',
    tone: 'muted',
  },
] as const

const toneStyles: Record<VersusModeCard['tone'], {
  card: string
  icon: string
  meta: string
}> = {
  warm: {
    card: 'border-[#E8A598]/30 bg-gradient-to-br from-white to-[#fff5f2]',
    icon: 'bg-[#E8A598] text-white',
    meta: 'bg-[#E8A598]/10 text-[#d18d80]',
  },
  blue: {
    card: 'border-[#7D8A96]/25 bg-gradient-to-br from-white to-[#f5f7f9]',
    icon: 'bg-[#7D8A96] text-white',
    meta: 'bg-[#7D8A96]/10 text-[#6c7985]',
  },
  muted: {
    card: 'border-[#EAE4E2] bg-white',
    icon: 'bg-[#F2EFED] text-[#7D8A96]',
    meta: 'bg-[#7D8A96]/8 text-[#7D8A96]',
  },
}

export default function VersusLobbyPage() {
  debugRender('VersusLobbyPage')

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50 [background-image:radial-gradient(circle_at_25%_25%,rgba(232,165,152,0.08)_0,transparent_35%),radial-gradient(circle_at_75%_70%,rgba(125,138,150,0.07)_0,transparent_35%)]" />
      <div className="pointer-events-none fixed -right-[8%] -top-[12%] z-0 h-80 w-80 rounded-full bg-[#E8A598]/12 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-[8%] -left-[8%] z-0 h-80 w-80 rounded-full bg-[#7D8A96]/12 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 py-12">

        {/* Header section */}
        <section className="mb-12 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E8A598] to-[#d18d80] text-white shadow-lg shadow-[#E8A598]/25">
            <span className="material-symbols-outlined text-3xl">swords</span>
          </div>
          <h1 className="mb-3 text-4xl font-black tracking-tight text-[#2c3e50]">
            Versus
          </h1>
          <p className="max-w-lg text-base font-light leading-relaxed text-[#7D8A96]">
            Compite en directo con las mismas preguntas y el mismo reloj. Reta a
            quien quieras con un enlace, o abre una sala para toda una clase.
          </p>
        </section>

        {/* Crear / entrar */}
        <VersusEntry />

        {/* Mode cards */}
        <section className="mb-10">
          <h2 className="mb-6 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
            Modos previstos
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {modes.map((mode) => {
              const styles = toneStyles[mode.tone]
              return (
                <article
                  key={mode.id}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-sm ${styles.card}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className={`rounded-xl p-3 ${styles.icon}`}>
                      <span className="material-symbols-outlined text-2xl">{mode.icon}</span>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${styles.meta}`}>
                      {mode.meta}
                    </span>
                  </div>

                  <h3 className="mb-2 text-xl font-bold text-[#2c3e50]">{mode.title}</h3>
                  <p className="mb-5 flex-1 text-sm leading-relaxed">{mode.description}</p>

                  <button
                    type="button"
                    disabled
                    className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#F2EFED] px-5 py-3 text-sm font-semibold text-[#7D8A96]/60"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    Próximamente
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        {/* Info strip */}
        <section className="rounded-2xl border border-[#EAE4E2] bg-white/60 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: 'link', label: 'Solo por invitación', desc: 'Se entra con un enlace o un PIN, nunca con desconocidos' },
              { icon: 'timer', label: 'Mismo reloj para todos', desc: 'La cuenta atrás sincroniza el arranque de cada pregunta' },
              { icon: 'school', label: 'Pensado para clase', desc: 'Un profesor podrá abrir una sala y proyectarla' },
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
