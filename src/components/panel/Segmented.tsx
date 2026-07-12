'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Control segmentado con "pill" deslizante animada (layoutId).
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  groupId,
  size = 'md',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  groupId: string
  size?: 'sm' | 'md'
}) {
  // La animación de layout solo se activa tras el primer frame: así el "pill"
  // se pinta ya en su sitio en la carga (no entra volando desde fuera de la caja)
  // y sí se desliza al cambiar de pestaña.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="inline-flex rounded-xl border border-[#EAE0D5] bg-white p-1 shadow-sm">
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`relative rounded-lg font-semibold transition-colors ${
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${active ? 'text-white' : 'text-[#7D8A96] hover:text-[#141514]'}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                layout={ready ? 'position' : false}
                initial={false}
                className="absolute inset-0 rounded-lg bg-[#E8A598]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
