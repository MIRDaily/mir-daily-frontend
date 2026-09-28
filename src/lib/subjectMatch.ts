// Reconocer una asignatura del MIR por su nombre.
//
// Hace falta en dos sitios con listas de claves DISTINTAS: el reparto de
// preguntas del simulacro (solo las 20 asignaturas con peso) y la identidad
// visual de las flashcards (esas 20 más las que existen en la Biblioteca sin
// peso propio, como Farmacología). El algoritmo es el mismo; lo que cambia es
// el vocabulario, así que vive aquí una sola vez.

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')

/** Palabras sueltas del nombre, ya normalizadas y sin conectores. */
export const wordsOf = (name: string) =>
  name
    .split(/[\s,/&·+-]+/)
    .map(normalize)
    .filter((w) => w.length > 2 && w !== 'del' && w !== 'las' && w !== 'los')

/**
 * Clave canónica de una asignatura, o `null` si no se reconoce.
 *
 * Se compara PALABRA a palabra, no por subcadenas: "urologia" está dentro de
 * "neurologia", así que una comparación laxa cruzaría las dos asignaturas y el
 * error saldría en silencio. Las palabras se miran en el orden en que aparecen,
 * de modo que en "Cirugía General y Digestivo" manda "digestivo".
 */
export function matchSubjectKey(
  name: string,
  keys: readonly string[],
  aliases: Readonly<Record<string, string>>,
): string | null {
  const words = wordsOf(name)
  if (words.length === 0) return null

  const known = new Set(keys)

  for (const word of words) {
    if (known.has(word)) return word

    const alias = aliases[word]
    if (alias && known.has(alias)) return alias

    // Abreviaturas y variantes: "neumo" ~ "neumologia", "traumato" ~ ...
    for (const candidate of keys) {
      if (word.length >= 5 && (candidate.startsWith(word) || word.startsWith(candidate))) {
        return candidate
      }
    }
  }
  return null
}
