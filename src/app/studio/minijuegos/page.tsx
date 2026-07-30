'use client'

import Link from 'next/link'

type MiniGame = {
  id: string
  href: string
  icon: string
  title: string
  description: string
  badge: string
}

const MINI_GAMES: ReadonlyArray<MiniGame> = [
  {
    id: 'gramswipe',
    href: '/studio/minijuegos/gramswipe',
    icon: 'vaccines',
    title: 'GramSwipe',
    description: 'Clasifica antibióticos por su espectro de cobertura deslizando la tarjeta en la dirección correcta.',
    badge: 'Antibióticos',
  },
]

export default function MinijuegosPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-6 py-8 text-[#7D8A96] antialiased">
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] z-0 h-96 w-96 rounded-full bg-[#E8A598]/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <section className="flex flex-col gap-2">
          <Link
            href="/studio"
            className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wider text-[#E8A598] uppercase"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Volver a Estudio
          </Link>
          <h1 className="text-4xl font-black tracking-tight text-[#2C3E50]">Minijuegos</h1>
          <p className="max-w-2xl text-lg font-light text-[#7D8A96]">Repasa a base de juego rápido, ideal para huecos entre sesiones de estudio.</p>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Listado de minijuegos">
          {MINI_GAMES.map((game) => (
            <Link
              key={game.id}
              href={game.href}
              className="group relative flex h-56 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]"
            >
              <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                <span className="material-symbols-outlined text-8xl text-[#2C3E50]">{game.icon}</span>
              </div>

              <div>
                <div className="relative z-10 mb-3 flex items-start justify-between">
                  <div className="rounded-xl bg-[#FFF5F3] p-2.5 text-[#E8A598] transition-colors duration-300 group-hover:bg-[#E8A598] group-hover:text-white">
                    <span className="material-symbols-outlined text-2xl">{game.icon}</span>
                  </div>
                  <span className="rounded border border-[#EAE4E2] bg-[#F2EFED] px-2 py-1 text-[10px] font-bold uppercase text-[#7D8A96]">
                    {game.badge}
                  </span>
                </div>
                <h3 className="relative z-10 mb-1 text-lg leading-tight font-bold text-[#2C3E50] transition-colors group-hover:text-[#E8A598]">
                  {game.title}
                </h3>
                <p className="relative z-10 line-clamp-3 text-xs text-[#7D8A96]/80">{game.description}</p>
              </div>

              <div className="relative z-10 flex items-center gap-1 text-xs font-bold text-[#E8A598]">
                Jugar
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
