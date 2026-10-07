// Subgrupos de un mapa («Concepto y epidemiología», «Clínica y complicaciones»): el nivel que
// reparte las hojas de una enfermedad por aspecto. Se dibujan como un rótulo sobre la rama, no
// como un nodo con caja. Solo cambia el dibujo: el mapa guardado no se toca.

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

// Palabras de aspecto (facetas) con las que la IA nombra los subgrupos, y los enlaces entre ellas.
const ASPECTOS = new Set(
  (
    'concepto conceptos definicion definiciones generalidades epidemiologia etiologia etiopatogenia patogenia ' +
    'fisiopatologia mecanismo mecanismos asociacion asociaciones genetica anatomia patologica factores riesgo ' +
    'clinica clinico manifestaciones sintomas signos exploracion complicacion complicaciones sospecha evolucion ' +
    'diagnostico diagnosticos pruebas laboratorio imagen criterios diferencial clasificacion tipos formas ' +
    'tratamiento tratamientos manejo terapia farmacos medidas generales indicaciones cirugia profilaxis ' +
    'prevencion pronostico seguimiento perlas mir otros otras datos aspectos'
  ).split(' '),
)
const ENLACES = new Set('y e o u de del la las el los su sus'.split(' '))

/** ¿El texto es un nombre de aspecto («Clínica y complicaciones»), y no una enfermedad? */
export function looksLikeSubgroupLabel(text: string): boolean {
  const words = quitarTildes(text.toLowerCase())
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0 || words.length > 6) return false
  let aspectos = 0
  for (const w of words) {
    if (ASPECTOS.has(w)) aspectos += 1
    else if (!ENLACES.has(w)) return false
  }
  return aspectos > 0
}

type SubgroupCandidate = {
  label: string
  parentId?: string
  childCount?: number
  /** Nodo de contorno (borde > 0). Los rellenos son bloques o categorías que el usuario pintó así. */
  outlined: boolean
}

/**
 * ¿Se dibuja como rótulo? Un nodo interno de contorno, que cuelga de algo, con nombre de aspecto
 * y cuyos hijos son todos hojas (texto o tablas). `childrenAreLeaves` lo calcula quien tiene el
 * árbol.
 */
export function isSubgroup(n: SubgroupCandidate, childrenAreLeaves: boolean): boolean {
  return !!n.parentId && !!n.childCount && n.outlined && childrenAreLeaves && looksLikeSubgroupLabel(n.label)
}
