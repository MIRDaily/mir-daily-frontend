// Resúmenes activos, modo «Escribir la respuesta» (puro, se prueba con `npm test`): lo escrito en un
// hueco se compara con lo tapado NORMALIZANDO (tildes, mayúsculas, espacios, puntuación, «%» y «por
// ciento», unidades, romanos) y se PROPONE «Lo sabía» / «No lo sabía»; el usuario lo puede cambiar.
// Nada de esto llega al servidor: solo la respuesta que el usuario da por buena.
//
// Deliberadamente sin tolerancia a erratas en lo que no sea casi idéntico: en medicina una letra cambia
// el dato (hipo/hiper, IgA/IgM, tipo I/tipo II). Solo se acepta una letra de diferencia en palabras
// largas (≥ 8 letras, sin cifras) y se avisa: «casi».

export type Comparacion = 'igual' | 'casi' | 'distinta' | 'vacia'

// Unidades que acompañan a una cifra y se pueden omitir al escribirla («40» por «40 %», «5» por «5
// mg/dl»). Ya normalizadas (sin tildes, minúsculas). Las compuestas («ug/kg/dia») valen si lo son todas
// sus partes.
const UNIDADES = new Set(
  (
    '% mg g kg ug ng pg ml l dl mmol umol mol meq mosm mosmol mmhg cmh2o cm mm um nm m m2 mm3 h hora horas min minutos ' +
    'seg segundos s dia dias semana semanas mes meses ano anos ui u x veces lpm rpm kda kcal cal fl ul celulas'
  ).split(' '),
)
const esUnidad = (x: string) => x.split('/').every((p) => p === '' || UNIDADES.has(p))
// Lo que nombra una cifra («tipo 2», «grado III»): se puede omitir y quedarse con el número.
const CLASES = new Set(['tipo', 'grado', 'estadio', 'clase', 'fase', 'nivel', 'escala'])
const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo'])
const ROMANOS: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' }

/** Palabras normalizadas: minúsculas, sin tildes, «por ciento» → «%», «≥» → «>=», «µg» → «ug», romanos → cifras. */
export function palabras(s: string): string[] {
  const t = String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/\bmcg\b/g, 'ug')
    .replace(/\bpor\s*ciento\b/g, '%')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/(\d),(\d)/g, '$1.$2')
    // La puntuación de los bordes y la que no forma parte de un dato.
    .replace(/[«»"“”'‘’¿?¡!;:()[\]{}]/g, ' ')
    .replace(/(\D)[.,](?=\s|$)/g, '$1 ')
    .replace(/,/g, ' ')
    // «40%» → «40 %», «5mg» → «5 mg», «>5» → «> 5» (la unidad o el signo pegados a la cifra).
    .replace(/(\d)(%|[a-z/]+)/g, '$1 $2')
    .replace(/([<>]=?|=|±)(\d)/g, '$1 $2')
    .replace(/-/g, ' ')
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ROMANOS[w] ?? w)
}

/** Forma compacta para comparar: sin artículos delante, sin espacios. */
export function normalizarRespuesta(s: string): string {
  const w = palabras(s)
  while (w.length > 1 && ARTICULOS.has(w[0])) w.shift()
  return w.join('')
}

const tieneCifra = (s: string) => /\d/.test(s)

/** Cifras y signos (lo que no se puede omitir) y lo demás. */
function partes(s: string): { cifras: string; resto: string[] } {
  const w = palabras(s).filter((x) => !ARTICULOS.has(x))
  return {
    cifras: w.filter((x) => /^[<>]=?$|^=$|^±$|\d/.test(x)).join(' '),
    resto: w.filter((x) => !/^[<>]=?$|^=$|^±$|\d/.test(x)),
  }
}

/** Distancia de edición, cortando en cuanto pasa de `max` (solo se usa con max = 1). */
function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let fila = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      fila = Math.min(fila, cur[j])
    }
    if (fila > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/**
 * Lo escrito frente a lo tapado:
 *   - «igual»: lo mismo normalizado; o, si el dato lleva cifras, las mismas cifras y signos y o bien lo
 *     mismo alrededor, o nada alrededor cuando lo de alrededor del dato son unidades o «tipo/grado…»;
 *   - «casi»: una letra de diferencia en una respuesta larga (≥ 8 letras) sin cifras;
 *   - «vacia»: no se ha escrito nada; «distinta»: lo demás.
 */
export function compararRespuesta(escrita: string, correcta: string): Comparacion {
  const e = normalizarRespuesta(escrita)
  if (!e) return 'vacia'
  const c = normalizarRespuesta(correcta)
  if (e === c) return 'igual'
  if (tieneCifra(c)) {
    const pe = partes(escrita)
    const pc = partes(correcta)
    if (pe.cifras !== pc.cifras) return 'distinta'
    if (pe.resto.join('') === pc.resto.join('')) return 'igual'
    const omitible = (x: string) => esUnidad(x) || CLASES.has(x)
    if (pc.resto.every(omitible) && pe.resto.every((x) => pc.resto.includes(x))) return 'igual'
    return 'distinta'
  }
  if (c.length >= 8 && !tieneCifra(e) && distancia(e, c, 1) <= 1) return 'casi'
  return 'distinta'
}

/** La respuesta que se propone: igual o casi → «Lo sabía». */
export const propuestaDe = (c: Comparacion): 'sabia' | 'no' => (c === 'igual' || c === 'casi' ? 'sabia' : 'no')
