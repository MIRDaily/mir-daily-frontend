'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LANDING_VARIANTS } from './variants'

/**
 * Selector flotante de variantes de landing.
 * Se muestra en la esquina inferior derecha de todas las landings
 * y permite saltar entre variantes o abrir la galería (/landings).
 */
export default function LandingSwitcher() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-64 flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-[0_18px_44px_-14px_rgba(58,54,50,0.45)]"
            style={{ borderColor: 'rgba(17,24,39,0.8)' }}
          >
            <span className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-[#8C857E]">
              Variantes de landing
            </span>
            {LANDING_VARIANTS.map((variant) => {
              const active = pathname === variant.path
              return (
                <Link
                  key={variant.slug}
                  href={variant.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#FBEFE9] ${
                    active ? 'bg-[#F3D9CF]' : ''
                  }`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-base"
                    style={{
                      background: variant.preview.bg,
                      borderColor: 'rgba(17,24,39,0.25)',
                    }}
                  >
                    {variant.emoji}
                  </span>
                  <span className="text-[#3A3632]">{variant.name}</span>
                  {active && (
                    <span className="material-symbols-outlined ml-auto text-[16px] text-[#B87A6F]">
                      check
                    </span>
                  )}
                </Link>
              )
            })}
            <Link
              href="/landings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border-t border-[#E5DED6] px-4 py-2.5 text-xs font-bold text-[#B87A6F] transition-colors hover:bg-[#FBEFE9]"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              Ver galería completa
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="flex items-center gap-2 rounded-full border-2 bg-white px-4 py-2.5 text-sm font-bold text-[#3A3632] shadow-[0_10px_28px_-10px_rgba(58,54,50,0.5)]"
        style={{ borderColor: 'rgba(17,24,39,0.8)' }}
        aria-expanded={open}
        aria-label="Cambiar variante de landing"
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="material-symbols-outlined text-[18px] text-[#B87A6F]"
        >
          {open ? 'close' : 'palette'}
        </motion.span>
        Landings
      </motion.button>
    </div>
  )
}
