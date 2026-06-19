'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { LANDING_VARIANTS } from './variants'

/**
 * Galería de variantes de landing (/landings).
 * Lee el registro central de variants.ts: cualquier landing nueva
 * registrada allí aparece aquí automáticamente.
 */
export default function LandingGallery() {
  return (
    <div className="min-h-screen bg-[#FAF7F4] px-6 py-16 text-[#171312] md:px-12">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 text-center"
        >
          <span className="mb-4 inline-block rounded-full bg-[#F3D9CF] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#8C5F56]">
            Galería interna
          </span>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Landings de <span className="text-[#B87A6F]">MirDaily</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#5C554F]">
            Todas las variantes en un mismo sitio. Entra en cualquiera de ellas
            para verla en acción; desde cada landing puedes volver aquí con el
            botón flotante «Landings».
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {LANDING_VARIANTS.map((variant, i) => (
            <motion.div
              key={variant.slug}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
            >
              <Link
                href={variant.path}
                className="block overflow-hidden rounded-3xl border-2 bg-white shadow-soft transition-shadow hover:shadow-[0_24px_50px_-20px_rgba(184,122,111,0.4)]"
                style={{ borderColor: 'rgba(17,24,39,0.8)' }}
              >
                {/* Mini-preview con los colores de la variante */}
                <div
                  className="relative flex h-40 items-center justify-center overflow-hidden"
                  style={{ background: variant.preview.bg }}
                >
                  <div
                    className="absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-2xl"
                    style={{ background: variant.preview.accent }}
                  />
                  <div
                    className="absolute -bottom-12 -right-8 h-44 w-44 rounded-full opacity-25 blur-2xl"
                    style={{ background: variant.preview.accent }}
                  />
                  <div className="relative text-center">
                    <span className="block text-4xl">{variant.emoji}</span>
                    <span
                      className="mt-2 block text-lg font-black tracking-tight"
                      style={{ color: variant.preview.text }}
                    >
                      Mir<span style={{ color: variant.preview.accent }}>Daily</span>
                    </span>
                  </div>
                  {/* Barras decorativas simulando contenido */}
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {[28, 44, 20].map((w, j) => (
                      <span
                        key={j}
                        className="h-1.5 rounded-full opacity-50"
                        style={{ width: w, background: variant.preview.accent }}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <h2 className="text-lg font-bold">{variant.name}</h2>
                    <span className="flex items-center gap-1 text-xs font-bold text-[#B87A6F]">
                      Ver
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#5C554F]">
                    {variant.description}
                  </p>
                  <p className="mt-3 rounded-lg bg-[#FAF7F4] px-2.5 py-1.5 font-mono text-[11px] text-[#8C857E]">
                    {variant.path}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center text-xs text-[#8C857E]"
        >
          Las variantes se registran en{' '}
          <code className="rounded bg-[#F3EBE3] px-1.5 py-0.5">
            src/components/landing/variants.ts
          </code>
        </motion.p>
      </div>
    </div>
  )
}
