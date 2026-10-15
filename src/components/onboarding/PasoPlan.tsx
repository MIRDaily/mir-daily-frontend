'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { INK } from '@/components/ui/sticker'

// Onboarding · «Elige tu plan» (MOCKUP, 15/10/2026). Todavía no hace nada: no se guarda en el servidor
// ni cambia lo que el usuario puede usar. La elección solo se recuerda en este navegador para volver a
// pintarla. Cuando haya planes de verdad, este paso asignará el plan (y la prueba de Pro) en ai_planes.
// Lo que incluye cada uno es la propuesta del 15/10/2026: Gratis = daily, sus estadísticas, Versus y
// MedGuess; Plus = las herramientas a mano y 50 créditos de IA al mes para probar; Pro = la IA.

export type PlanElegido = 'gratis' | 'plus' | 'pro'

const CLAVE = 'mirdaily.onboarding.plan'

export function leerPlanElegido(): PlanElegido | null {
  try {
    const v = window.localStorage.getItem(CLAVE)
    return v === 'gratis' || v === 'plus' || v === 'pro' ? v : null
  } catch {
    return null
  }
}

function guardarPlanElegido(p: PlanElegido) {
  try {
    window.localStorage.setItem(CLAVE, p)
  } catch {
    /* sin almacenamiento (navegación privada): no pasa nada, es solo un recuerdo */
  }
}

type Plan = {
  id: PlanElegido
  nombre: string
  lema: string
  precio: string
  color: string
  fondo: string
  icono: string
  incluye: string[]
  nota?: string
}

const PLANES: Plan[] = [
  {
    id: 'gratis',
    nombre: 'Gratis',
    lema: 'Para empezar con buen ritmo',
    precio: '0 €',
    color: '#7D8A96',
    fondo: '#F3F1EF',
    icono: 'wb_sunny',
    incluye: ['El Daily con su revisión', 'Las estadísticas del Daily', 'Versus con tus amigos', 'MedGuess'],
  },
  {
    id: 'plus',
    nombre: 'Plus',
    lema: 'Todas las herramientas, hechas por ti',
    precio: 'Gratis en la beta',
    color: '#5E8C5A',
    fondo: '#EAF3E8',
    icono: 'construction',
    incluye: [
      'Todo lo de Gratis',
      'Mazos y flashcards',
      'Mapas mentales',
      'Resúmenes activos',
      'Simulacros',
      'Repaso espaciado y panel de rendimiento completo',
      'Prueba la IA: 50 créditos al mes',
    ],
  },
  {
    id: 'pro',
    nombre: 'Pro',
    lema: 'La IA prepara el material contigo',
    precio: 'Gratis en la beta',
    color: '#C4655A',
    fondo: '#FCEFEC',
    icono: 'auto_awesome',
    incluye: [
      'Todo lo de Plus',
      'Mapas, flashcards y resúmenes con IA desde tus PDF, Word o PowerPoint',
      '700 créditos de IA al mes (+300 de regalo el primer mes)',
      'Siempre ves el precio antes de generar; si la IA falla, se devuelve',
    ],
    nota: 'Empieza con 7 días de prueba',
  },
]

function Icono({ nombre, color, tam = '1.25rem' }: { nombre: string; color: string; tam?: string }) {
  return (
    <span aria-hidden className="inline-block shrink-0 leading-none" style={{ color }}>
      <span className="material-symbols-outlined leading-none" style={{ fontSize: tam }}>
        {nombre}
      </span>
    </span>
  )
}

export default function PasoPlan({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const reducir = useReducedMotion()
  const [elegido, setElegido] = useState<PlanElegido>(() => (typeof window === 'undefined' ? null : leerPlanElegido()) ?? 'pro')

  const elegir = (p: PlanElegido) => {
    setElegido(p)
    guardarPlanElegido(p)
  }

  return (
    <section className="space-y-6" data-paso-plan>
      <div className="text-center">
        <h2 className="px-4 pb-2 text-3xl font-bold tracking-tight text-[#2C3E50] md:text-4xl">Elige tu plan</h2>
        <p className="mx-auto max-w-xl text-[0.95rem] text-[#7D8A96]">
          Puedes cambiarlo cuando quieras. Durante la beta todo es gratis y elegir un plan todavía no cambia nada.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Plan">
        {PLANES.map((p, k) => {
          const activo = elegido === p.id
          const recomendado = p.id === 'pro'
          return (
            <motion.button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => elegir(p.id)}
              initial={reducir ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: reducir ? 0 : 0.06 * k, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col rounded-3xl bg-white p-5 text-left transition-transform hover:-translate-y-0.5"
              style={{
                border: `2px solid ${activo ? INK : '#E9E4E1'}`,
                boxShadow: activo ? `5px 5px 0 0 ${INK}` : 'none',
                backgroundImage: activo ? `linear-gradient(160deg, ${p.fondo} 0%, #ffffff 55%)` : undefined,
              }}
              data-plan={p.id}
            >
              {recomendado && (
                <span
                  className="absolute -top-3 right-4 rounded-full px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white"
                  style={{ background: p.color, border: `2px solid ${INK}` }}
                >
                  Recomendado
                </span>
              )}
              <span className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: p.fondo, border: `2px solid ${INK}` }}>
                  <Icono nombre={p.icono} color={p.color} />
                </span>
                <span className="text-[1.3rem] font-black text-[#2C3E50]">{p.nombre}</span>
                <span
                  className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full"
                  style={{ border: `2px solid ${activo ? p.color : '#C9C2BE'}`, background: activo ? p.color : '#fff' }}
                  aria-hidden
                >
                  {activo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </span>
              <span className="mt-2 block text-[0.85rem] text-[#7D8A96]">{p.lema}</span>
              <span className="mt-3 block text-[1.05rem] font-black" style={{ color: p.color }}>
                {p.precio}
              </span>
              {p.nota && <span className="mt-0.5 block text-[0.75rem] font-bold text-[#7D8A96]">{p.nota}</span>}
              <ul className="mt-3 space-y-1.5">
                {p.incluye.map((x) => (
                  <li key={x} className="flex items-start gap-1.5 text-[0.82rem] leading-snug text-[#2C3E50]">
                    <Icono nombre="check" color={p.color} tam="1rem" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </motion.button>
          )
        })}
      </div>

      <p className="text-center text-[0.75rem] text-[#7D8A96]">
        Estudiar con lo que ya has creado nunca gasta créditos. Los precios llegarán al final de la beta.
      </p>

      <div className="flex w-full items-center justify-between px-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          className="group flex items-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-3 text-base font-bold text-white transition-colors hover:bg-[#D68C7F]"
          style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
        >
          Continuar con {PLANES.find((p) => p.id === elegido)?.nombre}
          <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
        </button>
      </div>
    </section>
  )
}
