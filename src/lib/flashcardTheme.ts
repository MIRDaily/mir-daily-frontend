// Paleta e iconos compartidos para las asignaturas de flashcards. Se guarda la
// CLAVE del color (p. ej. 'sage') en la BD y aquí se resuelve a tonos concretos.

export type SubjectColor = {
  key: string
  label: string
  bg: string // color principal
  soft: string // fondo suave
  text: string // texto sobre fondo suave
  ring: string // borde/halo
}

export const SUBJECT_COLORS: SubjectColor[] = [
  { key: 'coral', label: 'Coral', bg: '#E8A598', soft: '#FBEDE9', text: '#B5675A', ring: '#E8A598' },
  { key: 'sage', label: 'Salvia', bg: '#8BA888', soft: '#EAF1E9', text: '#5C7A59', ring: '#8BA888' },
  { key: 'sky', label: 'Cielo', bg: '#7BA7C4', soft: '#E7F0F6', text: '#4E7C9B', ring: '#7BA7C4' },
  { key: 'gold', label: 'Ámbar', bg: '#E0B15A', soft: '#FBF1DC', text: '#A87E28', ring: '#E0B15A' },
  { key: 'lavender', label: 'Lavanda', bg: '#9B8BC4', soft: '#EFEBF7', text: '#6E5EA0', ring: '#9B8BC4' },
  { key: 'rose', label: 'Rosa', bg: '#D48DA8', soft: '#F9EAF0', text: '#A85C78', ring: '#D48DA8' },
  { key: 'teal', label: 'Verde azulado', bg: '#6FB3A8', soft: '#E4F2EF', text: '#478C81', ring: '#6FB3A8' },
  { key: 'slate', label: 'Pizarra', bg: '#7D8A96', soft: '#ECEEF1', text: '#586573', ring: '#7D8A96' },
]

export const DEFAULT_COLOR_KEY = 'coral'

export function resolveColor(key?: string | null): SubjectColor {
  return SUBJECT_COLORS.find((c) => c.key === key) ?? SUBJECT_COLORS[0]
}

// Iconos (Material Symbols) elegibles para una asignatura.
export const SUBJECT_ICONS: string[] = [
  'style',
  'cardiology',
  'neurology',
  'pulmonology',
  'gastroenterology',
  'orthopedics',
  'medication',
  'vaccines',
  'psychology',
  'biotech',
  'healing',
  'science',
  'bloodtype',
  'coronavirus',
  'dentistry',
  'menu_book',
]

export const DEFAULT_ICON = 'style'

export function resolveIcon(icon?: string | null): string {
  return icon && SUBJECT_ICONS.includes(icon) ? icon : DEFAULT_ICON
}
