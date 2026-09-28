// Identidad visual de cada asignatura del MIR: sigla, icono, color y categoría.
//
// Las flashcards no cuelgan de la tabla `subjects`: cada "asignatura" es un mazo
// que el usuario crea con el nombre que quiere (`flashcards.subject_id` existe en
// la base pero la interfaz nunca lo rellena). Así que la asignatura se reconoce
// POR EL NOMBRE, con el mismo emparejador que reparte los pesos del simulacro
// (`subjectKeyFor`), y de ahí sale su categoría y su color.
//
// Un mazo cuyo nombre no case con ninguna asignatura no se queda fuera: cae en
// la categoría PERSONAL, que la lista muestra en su propia sección al final.

import { weightForSubject } from '@/lib/simulacro/mirWeights'
import { matchSubjectKey } from '@/lib/subjectMatch'
import { resolveColor, type SubjectColor } from '@/lib/flashcardTheme'

export type SubjectCategory = 'BÁSICA' | 'MÉDICA' | 'QUIRÚRGICA' | 'PERSONAL'

/** Orden en el que se pintan las secciones de la lista. */
export const CATEGORY_ORDER: SubjectCategory[] = ['BÁSICA', 'MÉDICA', 'QUIRÚRGICA', 'PERSONAL']

export const CATEGORY_LABEL: Record<SubjectCategory, string> = {
  'BÁSICA': 'Básicas',
  'MÉDICA': 'Médicas',
  'QUIRÚRGICA': 'Quirúrgicas',
  // "Otros" y no "Personales": lo que agrupa es todo lo que no se reconoce como
  // asignatura del MIR, y leyendo "Personales" cuesta entender por qué está ahí
  // un mazo que uno considera de una asignatura.
  PERSONAL: 'Otros',
}

type SubjectVisualEntry = {
  /** Nombre canónico, para cuando el mazo se llama de otra forma. */
  label: string
  /** Código AMIR, que es como las tiene fichadas cualquiera que prepare el MIR. */
  sigla: string
  /** Material Symbol. Solo nombres ya usados en la web, para no arriesgar glifos rotos. */
  icon: string
  /** Clave de SUBJECT_COLORS. */
  color: string
  category: Exclude<SubjectCategory, 'PERSONAL'>
}

// Son las 20 asignaturas con peso MIR más las que existen en la Biblioteca sin
// peso propio (Farmacología, Bioética, Cirugía Plástica): si alguien llama así a
// un mazo, es una asignatura de verdad y no un cajón personal.
//
// La categoría sigue la taxonomía que ya usa la Biblioteca
// (src/mocks/library.ts): Digestivo y Ginecología van como quirúrgicas porque
// allí son "Cirugía General y Digestivo" y "Ginecología y Obstetricia".
const SUBJECT_VISUALS: Record<string, SubjectVisualEntry> = {
  // Básicas
  estadistica: { label: 'Estadística', sigla: 'ET', icon: 'analytics', color: 'slate', category: 'BÁSICA' },
  inmunologia: { label: 'Inmunología', sigla: 'IM', icon: 'biotech', color: 'lavender', category: 'BÁSICA' },
  miscelanea: { label: 'Miscelánea', sigla: 'MC', icon: 'menu_book', color: 'slate', category: 'BÁSICA' },
  farmacologia: { label: 'Farmacología', sigla: 'FM', icon: 'medication', color: 'gold', category: 'BÁSICA' },
  bioetica: { label: 'Bioética', sigla: 'BE', icon: 'menu_book', color: 'lavender', category: 'BÁSICA' },

  // Médicas
  cardiologia: { label: 'Cardiología', sigla: 'CD', icon: 'cardiology', color: 'coral', category: 'MÉDICA' },
  dermatologia: { label: 'Dermatología', sigla: 'DM', icon: 'dermatology', color: 'rose', category: 'MÉDICA' },
  endocrinologia: { label: 'Endocrinología', sigla: 'ED', icon: 'monitor_weight', color: 'gold', category: 'MÉDICA' },
  hematologia: { label: 'Hematología', sigla: 'HM', icon: 'bloodtype', color: 'coral', category: 'MÉDICA' },
  infecciosas: { label: 'Infecciosas', sigla: 'IF', icon: 'coronavirus', color: 'teal', category: 'MÉDICA' },
  nefrologia: { label: 'Nefrología', sigla: 'NF', icon: 'water_drop', color: 'sky', category: 'MÉDICA' },
  neumologia: { label: 'Neumología', sigla: 'NM', icon: 'pulmonology', color: 'sky', category: 'MÉDICA' },
  neurologia: { label: 'Neurología', sigla: 'NR', icon: 'neurology', color: 'lavender', category: 'MÉDICA' },
  pediatria: { label: 'Pediatría', sigla: 'PD', icon: 'child_care', color: 'gold', category: 'MÉDICA' },
  psiquiatria: { label: 'Psiquiatría', sigla: 'PQ', icon: 'psychology', color: 'lavender', category: 'MÉDICA' },
  reumatologia: { label: 'Reumatología', sigla: 'RM', icon: 'rheumatology', color: 'sage', category: 'MÉDICA' },

  // Quirúrgicas
  digestivo: { label: 'Digestivo', sigla: 'DG', icon: 'gastroenterology', color: 'sage', category: 'QUIRÚRGICA' },
  ginecologia: { label: 'Ginecología', sigla: 'GC', icon: 'pregnant_woman', color: 'rose', category: 'QUIRÚRGICA' },
  oftalmologia: { label: 'Oftalmología', sigla: 'OF', icon: 'visibility', color: 'sky', category: 'QUIRÚRGICA' },
  otorrinolaringologia: { label: 'Otorrinolaringología', sigla: 'OR', icon: 'hearing', color: 'teal', category: 'QUIRÚRGICA' },
  traumatologia: { label: 'Traumatología', sigla: 'TM', icon: 'orthopedics', color: 'slate', category: 'QUIRÚRGICA' },
  urologia: { label: 'Urología', sigla: 'UR', icon: 'water_drop', color: 'teal', category: 'QUIRÚRGICA' },
  cirugiaplastica: { label: 'Cirugía Plástica', sigla: 'CP', icon: 'healing', color: 'rose', category: 'QUIRÚRGICA' },
}

// Nombres con los que el usuario puede bautizar el mazo y que no casan solos.
// Ojo: se comparan PALABRAS sueltas, así que "cirugia" no puede ser alias de
// nada — se la comen también "Cirugía General y Digestivo" y "Cirugía
// Ortopédica y Trauma", que deben resolverse por su otra palabra.
const VISUAL_ALIASES: Record<string, string> = {
  bioestadistica: 'estadistica',
  plastica: 'cirugiaplastica',
  farmaco: 'farmacologia',
  farmacia: 'farmacologia',
  legislacion: 'bioetica',
}

export type SubjectVisual = {
  /** Clave canónica, o `null` si el mazo no es una asignatura reconocida. */
  key: string | null
  sigla: string
  icon: string
  category: SubjectCategory
  /** Peso de la asignatura en el examen, para poder ordenar por relevancia. */
  mirWeight: number
  color: SubjectColor
}

/**
 * Identidad visual de un mazo de flashcards.
 *
 * `storedColor`/`storedIcon` son los que el usuario eligió a mano al crear el
 * mazo y mandan sobre los del mapa: si se tomó la molestia de elegir, se
 * respeta. Cuando vienen vacíos, la asignatura reconocida decide.
 */
export function subjectVisual(
  name: string,
  storedColor?: string | null,
  storedIcon?: string | null,
): SubjectVisual {
  const key = matchSubjectKey(name, Object.keys(SUBJECT_VISUALS), VISUAL_ALIASES)
  const entry = key === null ? null : SUBJECT_VISUALS[key]

  return {
    key,
    sigla: entry?.sigla ?? siglaFrom(name),
    icon: storedIcon || entry?.icon || 'style',
    category: entry?.category ?? 'PERSONAL',
    mirWeight: weightForSubject(name),
    color: resolveColor(storedColor || entry?.color),
  }
}

/**
 * Sigla de emergencia para un mazo que no es una asignatura del MIR: iniciales
 * de las dos primeras palabras, o las dos primeras letras si es una sola.
 */
function siglaFrom(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
