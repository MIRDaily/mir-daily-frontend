import type { GuideQuestionKind, GuideTier } from '@/types/studyGuide'

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
