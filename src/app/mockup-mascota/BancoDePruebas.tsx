'use client'

/* ════════════════════════════════════════════════════════════════════════
   Banco de pruebas de las poses de la mascota.  NO es una pantalla del
   producto: es una maqueta para ver cómo quedan los PNG de /img/mascota
   dentro del tutorial de verdad, sin tener que loguearse, levantar el
   backend y reiniciar los tutoriales cada vez que se cambia un dibujo.

   Monta el TutorialOverlay y el MascotBubble REALES con el guion REAL del
   Daily sobre un decorado de pega que solo aporta los `data-tutorial` a los
   que el foco se engancha. Lo único falso es el decorado.

   Borrable en cualquier momento: no lo importa nadie.
═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react'
import Image from 'next/image'
import MascotBubble from '@/components/tutorial/MascotBubble'
import TutorialOverlay from '@/components/tutorial/TutorialOverlay'
import { TUTORIAL_DAILY, TUTORIAL_STUDIO, pasoAppMovil } from '@/lib/tutorials/scripts'
import type { MascotPose, TutorialStep } from '@/lib/tutorials/types'

/** Las que usan los guiones. */
const DEL_TUTORIAL: MascotPose[] = ['saludo', 'senalando', 'hablando', 'despedida']
/** Dibujadas y normalizadas, pero todavía sin sitio asignado. */
const SUELTAS: MascotPose[] = [
  'senalando-abajo',
  'celebracion',
  'hablando-variante2',
  'confiado',
  'dudando',
  'haciendo-examen',
  'con-mazo',
]
const TODAS = [...DEL_TUTORIAL, ...SUELTAS]

const TEXTO_PRUEBA =
  'Este es tu sobre de hoy: cinco preguntas nuevas, una vez al día. Ábrelo y ya está.'

function guionDaily(): TutorialStep[] {
  const paso = pasoAppMovil('escritorio', true)
  return [
    ...TUTORIAL_DAILY.steps,
    ...(paso ? [paso] : []),
    ...(TUTORIAL_DAILY.cierre ?? []),
  ]
}

function Galeria({ poses, volteadas = false }: { poses: MascotPose[]; volteadas?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      {poses.map((p) => (
        <figure key={p} className="text-center">
          <div className={`relative size-40 ${volteadas ? '-scale-x-100' : ''}`}>
            <Image src={`/img/mascota/${p}.png`} alt={p} fill sizes="160px" className="object-contain" />
          </div>
          {!volteadas && <figcaption className="text-xs text-[#7D8A96]">{p}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

export default function BancoDePruebas() {
  const [guion, setGuion] = useState<'daily' | 'studio' | null>(null)
  const [indice, setIndice] = useState(0)
  const [elegida, setElegida] = useState<MascotPose>('senalando')

  const pasos = useMemo(() => {
    if (guion === 'daily') return guionDaily()
    if (guion === 'studio') return [...TUTORIAL_STUDIO.steps, ...(TUTORIAL_STUDIO.cierre ?? [])]
    return []
  }, [guion])

  const arrancar = (cual: 'daily' | 'studio') => {
    setIndice(0)
    setGuion(cual)
  }

  const avanzar = () => {
    if (indice + 1 >= pasos.length) setGuion(null)
    else setIndice(indice + 1)
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] px-6 py-8 text-[#2D3748]">
      {/* ── Decorado: solo existe para colgar de él las anclas del foco ── */}
      <header
        data-tutorial="nav-pestanas"
        className="mx-auto mb-8 flex max-w-4xl items-center gap-2 rounded-full border border-[#E8A598]/30 bg-white px-4 py-2 shadow-sm"
      >
        {['Daily', 'Studio', 'Mazos', 'Ranking', 'Perfil'].map((t, i) => (
          <span
            key={t}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              i === 0 ? 'bg-[#E8A598] text-white' : 'text-[#7D8A96]'
            }`}
          >
            {t}
          </span>
        ))}
      </header>

      <main className="mx-auto max-w-4xl">
        <div
          data-tutorial="daily-sobre"
          className="mb-6 flex h-52 items-center justify-center rounded-3xl border border-[#E8A598]/30 bg-white text-lg font-semibold shadow-[0_18px_40px_rgba(125,138,150,0.12)]"
        >
          El sobre de hoy · 5 preguntas
        </div>

        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <div
            data-tutorial="daily-fallada"
            className="flex h-36 items-center justify-center rounded-3xl border border-[#E8A598]/30 bg-white text-sm font-medium shadow-sm"
          >
            La más fallada de la semana
          </div>
          <div
            data-tutorial="daily-app-movil"
            className="flex h-36 items-center justify-center rounded-3xl border border-[#E8A598]/30 bg-white text-sm font-medium shadow-sm"
          >
            También en Android y iOS
          </div>
        </div>

        {/* Las tarjetas del Studio. Sin ellas, los pasos de ese tutorial no
            encuentran su ancla, degradan a cuadro centrado y no llega a
            salir la maqueta del modo — que solo se dibuja si hay foco. */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            ['studio-simulacro', 'Simulacro inteligente'],
            ['studio-preguntas-simulacros', 'Preguntas y simulacros'],
            ['studio-mazos', 'Mazos'],
            ['studio-flashcards', 'Flashcards'],
            ['studio-sala-zen', 'Sala Zen'],
          ].map(([ancla, titulo]) => (
            <div
              key={ancla}
              data-tutorial={ancla}
              className="flex h-28 items-center justify-center rounded-3xl border border-[#E8A598]/30 bg-white px-3 text-center text-sm font-medium shadow-sm"
            >
              {titulo}
            </div>
          ))}
        </div>

        {/* ── Mandos de la maqueta ── */}
        <section className="space-y-8 rounded-3xl border border-dashed border-[#E8A598]/50 bg-white/60 p-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#7D8A96]">
              Tutoriales completos
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => arrancar('daily')}
                className="rounded-full bg-[#E8A598] px-4 py-2 text-sm font-semibold text-white"
              >
                Reproducir tutorial del Daily
              </button>
              <button
                onClick={() => arrancar('studio')}
                className="rounded-full border border-[#E8A598] px-4 py-2 text-sm font-semibold text-[#E8A598]"
              >
                Reproducir el del Studio
              </button>
            </div>
          </div>

          {/* ── El bocadillo con su pico, pose a pose ── */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#7D8A96]">
              El bocadillo y su pico
            </p>
            <p className="mb-3 text-xs text-[#7D8A96]">
              Componente real. Elige una pose y míralo en las tres disposiciones que existen.
            </p>

            <div className="mb-5 flex flex-wrap gap-1.5">
              {TODAS.map((p) => (
                <button
                  key={p}
                  onClick={() => setElegida(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    elegida === p
                      ? 'bg-[#E8A598] text-white'
                      : 'border border-[#E8A598]/40 text-[#7D8A96]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <p className="mb-2 text-xs text-[#7D8A96]">
                  En fila · mascota a la izquierda (pico a la izquierda del bocadillo)
                </p>
                <MascotBubble texto={TEXTO_PRUEBA} pose={elegida} />
              </div>
              <div>
                <p className="mb-2 text-xs text-[#7D8A96]">
                  En fila · volteada, cuando el foco cae en la mitad derecha
                </p>
                <MascotBubble texto={TEXTO_PRUEBA} pose={elegida} mirandoIzquierda />
              </div>
              <div>
                <p className="mb-2 text-xs text-[#7D8A96]">
                  Apilada · móvil, o cuando hay maqueta del modo al lado (pico arriba)
                </p>
                <MascotBubble texto={TEXTO_PRUEBA} pose={elegida} apilada />
              </div>
            </div>
          </div>

          {/* ── Catálogo ── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7D8A96]">
              Las cuatro del tutorial · 160 px, que es como se pintan
            </p>
            <Galeria poses={DEL_TUTORIAL} />
            <p className="mb-2 mt-3 text-xs text-[#7D8A96]">Y volteadas por el código:</p>
            <Galeria poses={DEL_TUTORIAL} volteadas />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#7D8A96]">
              Dibujadas y normalizadas, todavía sin sitio
            </p>
            <p className="mb-3 text-xs text-[#7D8A96]">
              Mismo tamaño de cabeza y misma línea de suelo que las de arriba: son
              intercambiables con ellas.
            </p>
            <Galeria poses={SUELTAS} />
          </div>
        </section>
      </main>

      {guion && pasos[indice] && (
        <TutorialOverlay
          paso={pasos[indice]}
          indice={indice}
          total={pasos.length}
          onAvanzar={avanzar}
          onSaltar={() => setGuion(null)}
        />
      )}
    </div>
  )
}
