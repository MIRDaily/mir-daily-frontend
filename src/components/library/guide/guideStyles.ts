import type { GuideQuestionKind, GuideTier } from '@/types/studyGuide'
import type { GuideTrend } from '@/lib/studyGuides/stats'

export const TIER_STYLES: Record<GuideTier, { label: string; chip: string; bar: string; color: string }> = {
  imprescindible: {
    label: 'Imprescindible',
    chip: 'bg-[#E8A598]/15 text-[#B5655A]',
    bar: 'bg-[#E8A598]',
    color: '#E8A598',
  },
  alta: {
    label: 'Prioridad alta',
    chip: 'bg-[#8BA888]/15 text-[#5E7D5B]',
    bar: 'bg-[#8BA888]',
    color: '#8BA888',
  },
  media: {
    label: 'Prioridad media',
    chip: 'bg-[#D9B26F]/20 text-[#946C2C]',
    bar: 'bg-[#D9B26F]',
    color: '#D9B26F',
  },
  baja: {
    label: 'Pasada rápida',
    chip: 'bg-[#EAE4E2] text-[#6B7884]',
    bar: 'bg-[#BFC7CE]',
    color: '#BFC7CE',
  },
}

export const QUESTION_KIND_STYLES: Record<GuideQuestionKind, { label: string; chip: string }> = {
  bloque: { label: 'Bloque Neuro', chip: 'bg-[#2C3E50] text-white' },
  reserva: { label: 'Reserva', chip: 'bg-[#D9B26F]/20 text-[#946C2C]' },
  frontera: { label: 'Otra asignatura', chip: 'bg-[#EAE4E2] text-[#6B7884]' },
}

export const TREND_STYLES: Record<GuideTrend, { label: string; icon: string; chip: string }> = {
  sube: { label: 'Al alza', icon: 'trending_up', chip: 'bg-[#E8A598]/15 text-[#B5655A]' },
  estable: { label: 'Estable', icon: 'trending_flat', chip: 'bg-[#F2EFED] text-[#6B7884]' },
  baja: { label: 'A la baja', icon: 'trending_down', chip: 'bg-[#8FA9C2]/20 text-[#4F6D8A]' },
}

/** Color de celda del mapa de calor según las preguntas de ese año. */
export function heatCellClass(count: number) {
  if (count <= 0) return 'bg-[#F4F1EF] text-transparent'
  if (count === 1) return 'bg-[#E8A598]/25 text-[#B5655A]'
  if (count === 2) return 'bg-[#E8A598]/55 text-[#8F4A40]'
  if (count === 3) return 'bg-[#E8A598] text-white'
  return 'bg-[#C97B6D] text-white'
}
