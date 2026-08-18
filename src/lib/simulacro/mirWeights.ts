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

export const MIR_WEIGHTS: Record<string, number> = {
  digestivo: 9.8,
  cardiologia: 7.7,
  infecciosas: 7.2,
  neurologia: 6.4,
  neumologia: 6.3,
  endocrinologia: 6.1,
  ginecologia: 5.6,
  estadistica: 5.4,
  reumatologia: 4.7,
  pediatria: 4.5,
  psiquiatria: 4.3,
  hematologia: 4.2,
  nefrologia: 4.3,
  traumatologia: 3.8,
  dermatologia: 2.8,
  urologia: 2.5,
  inmunologia: 2.4,
  oftalmologia: 2.1,
  otorrinolaringologia: 1.6,
  // Bloque grande del gráfico que agrupa varias materias menores.
  miscelanea: 8.4,
}

/** Peso para una asignatura que no esté en la tabla. */
export const DEFAULT_WEIGHT = 3

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')

/** Peso de una asignatura por su nombre, tolerante a variantes de escritura. */
export function weightForSubject(name: string): number {
  const key = normalize(name)
  if (!key) return DEFAULT_WEIGHT
  for (const [candidate, weight] of Object.entries(MIR_WEIGHTS)) {
    if (key.startsWith(candidate) || candidate.startsWith(key)) return weight
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
