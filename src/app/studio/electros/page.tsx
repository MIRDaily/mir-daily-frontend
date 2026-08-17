'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { PATTERNS } from '@/lib/electros/patterns'
import { MODULES } from '@/lib/electros/academia/curriculum'

type ElectroTool = {
  id: string
  href: string
  icon: string
  title: string
  description: string
  badge: string
  meta: string
  cta: string
  accent: string
  soft: string
}

const TOOLS: ReadonlyArray<ElectroTool> = [
  {
    id: 'academia',
    href: '/studio/electros/academia',
    icon: 'school',
    title: 'Academia ECG',
    description:
      'Aprende paso a paso: de la mecánica eléctrica del corazón a los algoritmos diagnósticos, con animaciones interactivas y ejercicios en cada pantalla.',
    badge: 'Aprende',
    meta: `${MODULES.length} módulos guiados`,
    cta: 'Empezar la ruta',
    accent: '#E8A598',
    soft: '#FFF5F3',
  },
  {
    id: 'explorador',
    href: '/studio/electros/explorador',
    icon: 'monitor_heart',
    title: 'Explorador de 12 derivaciones',
    description:
      'Monitor animado y ECG completo de 12 derivaciones para estudiar los diagnósticos clave del MIR, con eje, territorios del infarto y modo examen.',
    badge: '12 derivaciones',
    meta: `${PATTERNS.length} diagnósticos · 25 mm/s`,
    cta: 'Abrir el explorador',
    accent: '#8BA888',
    soft: '#F1F5F0',
  },
]

export default function ElectrosHubPage() {
  const { setBackAction } = useHeaderUI()

  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio' })
    return () => setBackAction(null)
  }, [setBackAction])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] px-6 py-8 text-[#7D8A96] antialiased">
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] z-0 h-96 w-96 rounded-full bg-[#E8A598]/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8">
        <section className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-[#2C3E50]">Electrocardiografía</h1>
          <p className="max-w-2xl text-lg font-light text-[#7D8A96]">
            Aprende a leer un ECG desde cero y practica con trazos realistas generados en tiempo real.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-label="Herramientas de electrocardiografía">
          {TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#EAE4E2] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-[#2c3e50] hover:shadow-[4px_4px_0_0_#2c3e50]"
            >
              <div
                className="pointer-events-none absolute top-0 right-0 p-4 opacity-[0.06] transition-opacity group-hover:opacity-[0.12]"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-8xl text-[#2C3E50]">{tool.icon}</span>
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div
                    className="rounded-xl p-3 transition-colors"
                    style={{ backgroundColor: tool.soft, color: tool.accent }}
                  >
                    <span className="material-symbols-outlined text-3xl">{tool.icon}</span>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      borderColor: `${tool.accent}33`,
                      backgroundColor: `${tool.accent}1a`,
                      color: tool.accent,
                    }}
                  >
                    {tool.badge}
                  </span>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-[#2C3E50]">{tool.title}</h2>
                <p className="mb-4 text-sm sm:text-base">{tool.description}</p>
                <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-[#7D8A96]/70">{tool.meta}</p>
              </div>

              <span
                className="relative z-10 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-medium text-white shadow-md transition-transform sm:w-auto"
                style={{ backgroundColor: tool.accent, boxShadow: `0 4px 14px ${tool.accent}33` }}
              >
                {tool.cta}
                <span className="material-symbols-outlined">arrow_forward</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="rounded-2xl border border-[#EAE4E2] bg-white/70 p-5">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#E8A598]">lightbulb</span>
            <p className="text-sm">
              Los trazos no son imágenes: se sintetizan latido a latido a partir de un modelo del vector cardíaco, así
              que el eje, la progresión de R y las derivaciones son coherentes entre sí. Empieza por la{' '}
              <b className="text-[#2C3E50]">Academia</b> si nunca has leído un ECG con método.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
