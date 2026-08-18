// Peso de cada asignatura dentro del MIR, para el botón "MIR" del creador de
// simulacros: en vez de repartir las preguntas a partes iguales, se reparten
// como caen en el examen real.
//
// ─────────────────────────────────────────────────────────────────────────────
// OJO AL MANTENERLO
//
// Los porcentajes salen del gráfico "Importancia de la asignatura dentro del
// MIR" y suman 100. Las claves son NOMBRES de asignatura y se comparan sin
// tildes ni mayúsculas, así que basta con que el nombre de la base de datos
// empiece igual (p. ej. "Digestivo y cirugía general" casa con "digestivo").
//
// Una asignatura de la base de datos que no aparezca aquí NO se queda fuera:
// recibe `DEFAULT_WEIGHT`. Y los pesos se renormalizan sobre las asignaturas
// que existan, así que mientras no estén todas subidas el reparto sigue siendo
// proporcional entre las que hay.
// ─────────────────────────────────────────────────────────────────────────────

// Ordenado de mayor a menor. El código AMIR del gráfico va en el comentario
// para poder cotejarlo de un vistazo con la fuente.
export const MIR_WEIGHTS: Record<string, number> = {
  digestivo: 9.8, // DG
  miscelanea: 8.4, // MC
  cardiologia: 7.7, // CD
  infecciosas: 7.2, // IF
  neurologia: 6.4, // NR
  neumologia: 6.3, // NM
  endocrinologia: 6.1, // ED
  ginecologia: 5.6, // GC
  estadistica: 5.4, // ET
  reumatologia: 4.7, // RM
  traumatologia: 4.5, // TM
  pediatria: 4.3, // PD
  nefrologia: 4.3, // NF
  psiquiatria: 4.2, // PQ
  hematologia: 3.8, // HM
  otorrinolaringologia: 2.8, // OR
  dermatologia: 2.5, // DM
  urologia: 2.4, // UR
  inmunologia: 2.1, // IM
  oftalmologia: 1.6, // OF
}

/** Nombres alternativos con los que puede venir una asignatura de la base. */
const ALIASES: Record<string, string> = {
  otorrino: 'otorrinolaringologia',
  orl: 'otorrinolaringologia',
  cot: 'traumatologia',
  traumato: 'traumatologia',
  obstetricia: 'ginecologia',
  ginecologiayobstetricia: 'ginecologia',
  epidemiologia: 'estadistica',
  endocrino: 'endocrinologia',
  neumo: 'neumologia',
  nefro: 'nefrologia',
  neuro: 'neurologia',
  hemato: 'hematologia',
  derma: 'dermatologia',
  psiquiatra: 'psiquiatria',
  uro: 'urologia',
  oftalmo: 'oftalmologia',
  inmuno: 'inmunologia',
  infeccioso: 'infecciosas',
  microbiologia: 'infecciosas',
}

/** Peso para una asignatura que no esté en la tabla. */
export const DEFAULT_WEIGHT = 3

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')

/** Palabras sueltas del nombre, ya normalizadas y sin conectores. */
const wordsOf = (name: string) =>
  name
    .split(/[\s,/&·+-]+/)
    .map(normalize)
    .filter((w) => w.length > 2 && w !== 'del' && w !== 'las' && w !== 'los')

/**
 * Peso de una asignatura por su nombre.
 *
 * Se compara PALABRA a palabra, no por subcadenas: "urologia" está dentro de
 * "neurologia", así que una comparación laxa cruzaría las dos asignaturas y el
 * reparto saldría mal sin que se note.
 */
export function weightForSubject(name: string): number {
  const words = wordsOf(name)
  if (words.length === 0) return DEFAULT_WEIGHT

  for (const word of words) {
    // Coincidencia exacta de la palabra con una clave o con un alias.
    const direct = MIR_WEIGHTS[word] ?? MIR_WEIGHTS[ALIASES[word] ?? '']
    if (direct !== undefined) return direct

    // Abreviaturas y variantes: "neumo" ~ "neumologia", "traumato" ~ ...
    for (const [candidate, weight] of Object.entries(MIR_WEIGHTS)) {
      if (word.length >= 5 && (candidate.startsWith(word) || word.startsWith(candidate))) {
        return weight
      }
    }
  }
  return DEFAULT_WEIGHT
}

/**
 * Reparte `total` preguntas entre las asignaturas según su peso.
 *
 * Usa el método del resto mayor: reparte la parte entera y luego da las que
 * sobran a quienes tienen el decimal más alto, de modo que la suma cuadra
 * exactamente con `total` (con un reparto proporcional simple casi siempre
 * faltarían o sobrarían una o dos).
 */
export function allocateByWeight(
  total: number,
  subjects: { id: number; name: string }[],
): { subjectId: number; count: number }[] {
  if (subjects.length === 0 || total <= 0) return []

  const weights = subjects.map((s) => ({ id: s.id, weight: weightForSubject(s.name) }))
  const sum = weights.reduce((acc, w) => acc + w.weight, 0)
  if (sum <= 0) return subjects.map((s) => ({ subjectId: s.id, count: 0 }))

  const exact = weights.map((w) => ({ id: w.id, ideal: (w.weight / sum) * total }))
  const base = exact.map((e) => ({ id: e.id, count: Math.floor(e.ideal), rest: e.ideal - Math.floor(e.ideal) }))

  let left = total - base.reduce((acc, b) => acc + b.count, 0)
  const byRest = [...base].sort((a, b) => b.rest - a.rest)
  for (let i = 0; left > 0 && i < byRest.length; i++, left--) byRest[i].count += 1
  // Si aún sobran (más preguntas que asignaturas), se da otra vuelta.
  for (let i = 0; left > 0; i = (i + 1) % byRest.length, left--) byRest[i].count += 1

  return base.map((b) => ({ subjectId: b.id, count: b.count }))
}
