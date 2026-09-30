'use client'

import { useState, useSyncExternalStore } from 'react'
import { AnimatePresence } from 'framer-motion'
import ReportModal from './ReportModal'
import {
  contentKeyOf,
  isReported,
  subscribeReported,
  type ReportContext,
  type ReportTarget,
} from '@/lib/reports/api'

type ReportButtonProps = {
  target: ReportTarget
  context: ReportContext
  optionCount?: number
  subtitle?: string
  /**
   * `icon`: cuadrado como SaveToDeckButton (`compact` = 36 px, para barras).
   * `text`: icono + "Reportar pregunta", discreto, para pies de tarjeta.
   */
  variant?: 'icon' | 'text'
  compact?: boolean
  label?: string
  className?: string
}

// Botón "reportar" reutilizable. Autónomo: abre su propia ventana y recuerda
// en la pestaña si ya se reportó (bandera rellena).
export default function ReportButton({
  target,
  context,
  optionCount,
  subtitle,
  variant = 'icon',
  compact = false,
  label = 'Reportar pregunta',
  className,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const key = contentKeyOf(target)
  const reported = useSyncExternalStore(
    subscribeReported,
    () => isReported(key),
    () => false,
  )

  const glyph = (
    <span
      className={`material-symbols-outlined ${variant === 'text' ? 'text-lg' : compact ? 'text-[18px]' : 'text-[20px]'}`}
      style={reported ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      report
    </span>
  )

  return (
    <>
      {variant === 'text' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
            reported ? 'text-[#C4655A]' : 'text-[#9CA3AF] hover:text-[#7D8A96]'
          } ${className ?? ''}`}
        >
          {glyph}
          {reported ? 'Reportada' : label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={reported ? 'Ya la reportaste' : label}
          className={`flex items-center justify-center border bg-white shadow-sm transition-all ${
            compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
          } ${
            reported
              ? 'border-[#E8A598]/60 text-[#C4655A]'
              : 'border-[#E9E4E1] text-[#7D8A96] hover:border-[#E8A598]/40 hover:text-[#C4655A]'
          } ${className ?? ''}`}
        >
          {glyph}
        </button>
      )}

      <AnimatePresence>
        {open ? (
          <ReportModal
            key="report-modal"
            target={target}
            context={context}
            optionCount={optionCount}
            subtitle={subtitle}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
