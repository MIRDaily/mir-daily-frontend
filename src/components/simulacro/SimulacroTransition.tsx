'use client'

/* ════════════════════════════════════════════════════════════════════════
   Puente entre el creador y el simulacro.

   Antes el cambio de fase era un corte seco: desaparecía el formulario y
   aparecía la primera pregunta. Esta pantalla cubre ese salto y, de paso,
   ocupa la espera real de la generación contando qué se está haciendo.

   Dos decisiones sostienen que el final no dé un tirón:

   1. Comparte marco con el simulacro. Reproduce su contenedor y su barra de
      sesión en la misma posición, así que al levantarse el telón la barra ya
      estaba ahí: solo se revela el cuerpo de la pregunta. Que algo permanezca
      es lo que hace que la transición se lea como continua.
   2. La tarjeta va donde irá el enunciado, no centrada en la pantalla. Antes
      la mirada tenía que saltar de media pantalla al primer párrafo.

   El pase tampoco es puro adorno: la página espera a que la petición termine
   Y a que se cumpla un mínimo en pantalla, así que nunca parpadea aunque el
   backend responda en 80 ms.
═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/** Pasos que se van marcando; los tiempos son de sensación, no reales. */
const STEPS = [
  { label: 'Seleccionando preguntas', icon: 'search', at: 0 },
  { label: 'Barajando el orden', icon: 'shuffle', at: 520 },
  { label: 'Preparando la corrección', icon: 'fact_check', at: 1040 },
] as const

/** Un paso se marca hecho pasado este tiempo desde que empezó. */
const STEP_DONE_AFTER = 460

export default function SimulacroTransition({
  count,
  mode,
}: {
  count: number
  mode: 'immediate' | 'deferred'
}) {
  const [elapsed, setElapsed] = useState(0)

  // Un intervalo corto basta: los umbrales son de cientos de milisegundos, así
  // que seguir el reloj a 60 fps solo repintaría la lista sin que cambie nada.
  useEffect(() => {
    const startedAt = performance.now()
    const id = window.setInterval(() => setElapsed(performance.now() - startedAt), 120)
    return () => window.clearInterval(id)
  }, [])

  return (
    // La salida es un fundido puro: al escalar el telón mientras se va, el
    // contenido de debajo parecía moverse con él y se leía como un tirón.
    <motion.div
      className="fixed inset-0 z-[60] overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Fondo opaco: tapa por completo el formulario que hay debajo */}
      <div className="fixed inset-0 bg-[#FAF7F4]" />
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/15 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-12%] left-[-8%] h-[26rem] w-[26rem] rounded-full bg-[#8BA888]/15 blur-3xl" />

      {/* Mismo contenedor que la página y que el runner, para que la barra de
          sesión caiga exactamente donde va a estar después. */}
      <div className="relative mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">
          <SessionBarPreview count={count} mode={mode} />

          <motion.div
            className="rounded-3xl border-2 border-[#2c3e50] bg-white px-7 py-9 text-center"
            style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            // Se va antes que el fondo: primero se deshace la tarjeta y después
            // se levanta el telón, en vez de que todo desaparezca de golpe.
            exit={{ opacity: 0, y: -10, transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <ShufflingCards />

            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#d18d80]">
              Preparando tu simulacro
            </p>
            <p className="mt-1.5 text-2xl font-black leading-tight text-[#2c3e50]">
              {count} {count === 1 ? 'pregunta' : 'preguntas'}
            </p>
            <p className="mt-1 text-sm text-[#7D8A96]">
              Corrección {mode === 'immediate' ? 'inmediata' : 'al final'}
            </p>

            <ul className="mx-auto mt-7 flex max-w-sm flex-col gap-2.5 text-left">
              {STEPS.map((step) => {
                const done = elapsed > step.at + STEP_DONE_AFTER
                const active = elapsed > step.at && !done
                return (
                  <li
                    key={step.label}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-colors ${
                      done
                        ? 'border-[#8BA888]/45 bg-[#F1F5F0]'
                        : active
                          ? 'border-[#2c3e50] bg-white'
                          : 'border-[#EAE4E2] bg-white opacity-45'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        done ? 'bg-[#8BA888] text-white' : 'bg-[#F2EFED] text-[#7D8A96]'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        {done ? 'check' : step.icon}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-bold ${done || active ? 'text-[#2c3e50]' : 'text-[#7D8A96]'}`}
                    >
                      {step.label}
                    </span>
                    {active ? (
                      <span className="ml-auto h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Copia inerte de la barra de sesión del runner.
 *
 * Debe coincidir con la del simulacro (mismas clases, mismo hueco inferior):
 * al desvanecerse el telón, la de abajo ya está en su sitio y el relevo no se
 * ve. Si se toca el estilo de una, hay que tocar el de la otra.
 */
function SessionBarPreview({ count, mode }: { count: number; mode: 'immediate' | 'deferred' }) {
  return (
    <div
      aria-hidden
      className="mb-8 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-3"
      style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center justify-center rounded-lg p-1.5 text-[#7D8A96]/40">
          <span className="material-symbols-outlined">close</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8A598]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#d18d80]">
          <span className="material-symbols-outlined text-sm">
            {mode === 'immediate' ? 'bolt' : 'flag'}
          </span>
          {mode === 'immediate' ? 'Inmediata' : 'Al final'}
        </span>
        <span className="ml-auto text-sm font-black tabular-nums text-[#2c3e50]">
          1<span className="text-[#7D8A96]/60"> / {count}</span>
        </span>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full border border-[#EAE4E2] bg-[#F2EFED]">
        {/* Arranca vacía y crece hasta la primera pregunta, que es justo donde
            la recogerá la barra de verdad. */}
        <motion.div
          className="h-full rounded-full bg-[#E8A598]"
          initial={{ width: '0%' }}
          animate={{ width: `${Math.round((1 / count) * 100)}%` }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

/** Tres fichas de examen barajándose, para que la espera tenga movimiento. */
function ShufflingCards() {
  const cards = [
    { delay: 0, x: -34, rot: -12 },
    { delay: 0.22, x: 0, rot: 3 },
    { delay: 0.44, x: 34, rot: 12 },
  ]

  return (
    <div className="relative mx-auto h-24 w-44">
      {cards.map((c, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-20 w-14 rounded-xl border-2 border-[#2c3e50] bg-white"
          style={{ marginLeft: -28, marginTop: -40, boxShadow: '3px 3px 0 0 #2c3e50' }}
          initial={{ x: 0, rotate: 0, opacity: 0 }}
          animate={{
            x: [0, c.x, 0],
            rotate: [0, c.rot, 0],
            y: [0, -10, 0],
            opacity: 1,
          }}
          transition={{
            duration: 1.6,
            delay: c.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <span className="absolute inset-x-2.5 top-3 h-1.5 rounded-full bg-[#E8A598]" />
          <span className="absolute inset-x-2.5 top-7 h-1.5 rounded-full bg-[#EAE4E2]" />
          <span className="absolute inset-x-2.5 top-11 h-1.5 rounded-full bg-[#EAE4E2]" />
        </motion.div>
      ))}
    </div>
  )
}
