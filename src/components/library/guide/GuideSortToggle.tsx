'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'

export type GuideSortKey = 'prevision' | 'historico' | 'tendencia'

const SORT_OPTIONS: Array<{ key: GuideSortKey; label: string; icon: string }> = [
  { key: 'prevision', label: 'Previsión', icon: 'online_prediction' },
  { key: 'historico', label: 'Histórico', icon: 'history' },
  { key: 'tendencia', label: 'Tendencia', icon: 'trending_up' },
]

export function sortGuideTopics(topics: GuideTopicWithStats[], key: GuideSortKey) {
  const byHistory = (a: GuideTopicWithStats, b: GuideTopicWithStats) => b.stats.historyCount - a.stats.historyCount
  return [...topics].sort((a, b) => {
    if (key === 'historico') return byHistory(a, b)
    if (key === 'tendencia') {
      const shiftA = a.stats.recentAvg - a.stats.earlierAvg
      const shiftB = b.stats.recentAvg - b.stats.earlierAvg
      return shiftB - shiftA || byHistory(a, b)
    }
    return b.stats.forecast - a.stats.forecast || byHistory(a, b)
  })
}

type GuideSortToggleProps = {
  value: GuideSortKey
  onChange: (key: GuideSortKey) => void
  className?: string
}

// Selector "Ordenar por" (previsión, histórico, tendencia). Cada instancia lleva su propio layoutId
// para que la píldora animada no salte de un gráfico a otro.
export default function GuideSortToggle({ value, onChange, className = '' }: GuideSortToggleProps) {
  const pillId = useId()
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold text-[#7D8A96]">Ordenar por</span>
      <div className="flex rounded-full bg-[#F2EFED] p-1" role="radiogroup" aria-label="Ordenar temas">
        {SORT_OPTIONS.map((option) => {
          const active = option.key === value
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.key)}
              className={`relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? 'text-white' : 'text-[#2C3E50] hover:text-[#B5655A]'
              }`}
            >
              {active ? (
                <motion.span
                  layoutId={`guia-sort-pill-${pillId}`}
                  className="absolute inset-0 rounded-full bg-[#2C3E50]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="material-symbols-outlined relative text-[15px]">{option.icon}</span>
              <span className="relative">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
