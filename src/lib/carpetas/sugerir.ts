// Sugerir la carpeta (asignatura y tema del catálogo) de un mapa o un grupo a partir de sus textos: el
// título del documento, su índice, el nombre del grupo, los temas de las tarjetas o los párrafos. Sin IA
// ni red: el catálogo son ~225 nombres y esto tarda microsegundos. Es el mismo algoritmo de parecido que
// usa el backend para comparar temarios (scripts/temas/emparejar.js).
//
// Cada texto vota por el tema que más se le parece (si se parece lo bastante) y por su asignatura; el
// peso de cada texto lo pone quien llama (el título pesa más que cada etiqueta suelta). Con votos claros
// por un tema → ese tema; si solo destaca la asignatura → su «General»; si no → «Sin clasificar».

export type TemaCatalogo = { id: number; nombre: string }
export type AsignaturaCatalogo = {
  id: number
  nombre: string
  nombreCorto: string
  sigla: string | null
  subtitulo: string | null
  temas: TemaCatalogo[]
}

/** Dónde va: asignatura y tema; `subjectId` null = «Sin clasificar», `topicId` null = «General». */
export type Carpeta = { subjectId: number | null; topicId: number | null }
export const SIN_CLASIFICAR: Carpeta = { subjectId: null, topicId: null }

export type TextoPonderado = { texto: string; peso: number }
export type Sugerencia = {
  /** Lo que se preselecciona (SIN_CLASIFICAR si no hay nada claro). */
  carpeta: Carpeta
  confianza: 'alta' | 'media' | 'baja'
  /** Otras opciones razonables, de la más a la menos parecida (sin repetir la elegida). */
  candidatas: Carpeta[]
}

const STOP = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'su', 'sus',
  'u', 'un', 'una', 'y', 'otra', 'otras', 'otro', 'otros', 'tema',
])

export function normalizar(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

function raiz(p: string): string {
  if (p.length > 5 && p.endsWith('es') && !/[aeiou]es$/.test(p)) return p.slice(0, -2)
  if (p.length > 4 && p.endsWith('s')) return p.slice(0, -1)
  return p
}

function palabras(texto: string): string[] {
  return [...new Set(normalizar(texto).split(' ').filter((p) => p && !STOP.has(p)).map(raiz))]
}

function trigramas(texto: string): Set<string> {
  const t = ` ${palabras(texto).join(' ')} `
  const set = new Set<string>()
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3))
  return set
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let comun = 0
  for (const x of a) if (b.has(x)) comun++
  return (2 * comun) / (a.size + b.size)
}

/** Parecido de 0 a 1 entre dos nombres (palabras + trigramas; contener entero al otro suma con techo). */
export function parecido(a: string, b: string): number {
  if (normalizar(a) === normalizar(b)) return 1
  const pa = new Set(palabras(a))
  const pb = new Set(palabras(b))
  const porPalabras = dice(pa, pb)
  const porLetras = dice(trigramas(a), trigramas(b))
  let comun = 0
  for (const x of pa) if (pb.has(x)) comun++
  const menor = Math.min(pa.size, pb.size)
  const contenido = menor > 0 && comun === menor ? 0.75 : 0
  return Math.max(0.6 * porPalabras + 0.4 * porLetras, contenido * Math.max(porLetras, 0.8))
}

/** Un texto vota por un tema si se le parece al menos esto. */
const VOTA_TEMA = 0.45
/** Y por una asignatura si se parece a su nombre al menos esto («Reumatología - repaso»). */
const VOTA_ASIGNATURA = 0.6
/** Fracción del peso que ha votado que debe llevarse el ganador para preseleccionarlo. */
const MAYORIA = 0.4
/** Y votos mínimos en absoluto: una etiqueta suelta entre cincuenta no decide (el título vale 3). */
const MINIMO = 0.5

export function sugerirCarpeta(arbol: AsignaturaCatalogo[], textos: TextoPonderado[]): Sugerencia {
  const validos = textos.filter((t) => t.peso > 0 && normalizar(t.texto).length > 1)
  // Solo cuenta el peso de los textos que se parecen a algo: un título como «JIJI» no aporta nada y no
  // debe diluir lo que dicen las etiquetas.
  let total = 0
  const votosTema = new Map<number, { subjectId: number; votos: number }>()
  const votosAsig = new Map<number, number>()
  const temas = arbol.flatMap((a) => a.temas.map((t) => ({ ...t, subjectId: a.id })))

  for (const { texto, peso } of validos) {
    let mejor: { id: number; subjectId: number; p: number } | null = null
    for (const t of temas) {
      const p = parecido(texto, t.nombre)
      if (!mejor || p > mejor.p) mejor = { id: t.id, subjectId: t.subjectId, p }
    }
    let vota = false
    if (mejor && mejor.p >= VOTA_TEMA) {
      vota = true
      const v = votosTema.get(mejor.id) ?? { subjectId: mejor.subjectId, votos: 0 }
      v.votos += peso * mejor.p
      votosTema.set(mejor.id, v)
      votosAsig.set(mejor.subjectId, (votosAsig.get(mejor.subjectId) ?? 0) + peso * mejor.p)
    }
    for (const a of arbol) {
      const p = Math.max(parecido(texto, a.nombre), parecido(texto, a.nombreCorto))
      if (p >= VOTA_ASIGNATURA) {
        vota = true
        votosAsig.set(a.id, (votosAsig.get(a.id) ?? 0) + peso * p)
      }
    }
    if (vota) total += peso
  }

  const rankingTemas = [...votosTema.entries()].sort((x, y) => y[1].votos - x[1].votos)
  const rankingAsig = [...votosAsig.entries()].sort((x, y) => y[1] - x[1])
  const temaTop = rankingTemas[0]
  const asigTop = rankingAsig[0]

  let carpeta: Carpeta = SIN_CLASIFICAR
  let confianza: Sugerencia['confianza'] = 'baja'
  if (temaTop && temaTop[1].votos >= Math.max(MINIMO, MAYORIA * total) && (!asigTop || asigTop[0] === temaTop[1].subjectId)) {
    carpeta = { subjectId: temaTop[1].subjectId, topicId: temaTop[0] }
    confianza = 'alta'
  } else if (asigTop && asigTop[1] >= Math.max(MINIMO, MAYORIA * total)) {
    carpeta = { subjectId: asigTop[0], topicId: null }
    confianza = 'media'
  }

  // Candidatas: los temas votados (de la asignatura elegida primero) y las asignaturas votadas.
  const mismas = (a: Carpeta, b: Carpeta) => a.subjectId === b.subjectId && a.topicId === b.topicId
  const candidatas: Carpeta[] = []
  const meter = (c: Carpeta) => {
    if (!mismas(c, carpeta) && !candidatas.some((x) => mismas(x, c))) candidatas.push(c)
  }
  const temasOrdenados = carpeta.subjectId === null
    ? rankingTemas
    : [...rankingTemas.filter(([, v]) => v.subjectId === carpeta.subjectId), ...rankingTemas.filter(([, v]) => v.subjectId !== carpeta.subjectId)]
  for (const [id, v] of temasOrdenados) meter({ subjectId: v.subjectId, topicId: id })
  for (const [id] of rankingAsig) meter({ subjectId: id, topicId: null })
  return { carpeta, confianza, candidatas: candidatas.slice(0, 3) }
}

/**
 * Para repartir un documento por temas (mapas tema a tema, un grupo por tema) dentro de la carpeta que
 * el usuario ha elegido para el conjunto: si eligió un tema, todo a ese tema; si eligió una asignatura,
 * cada parte al tema de esa asignatura que más se le parezca (o a su «General»); si «Sin clasificar», ahí.
 */
/** La carpeta de partida para repartir varias partes: una sugerencia de tema concreto sube a su asignatura
 *  (lo sugerido miraba el documento entero); lo que eligió el usuario se respeta tal cual. */
export function baseParaPartes(c: Carpeta, origen: 'usuario' | 'sugerencia'): Carpeta {
  return origen === 'sugerencia' && c.topicId !== null ? { subjectId: c.subjectId, topicId: null } : c
}

export function carpetaDeParte(arbol: AsignaturaCatalogo[], elegida: Carpeta, tituloParte: string): Carpeta {
  if (elegida.subjectId === null || elegida.topicId !== null) return elegida
  const asig = arbol.find((a) => a.id === elegida.subjectId)
  if (!asig) return elegida
  let mejor: { id: number; p: number } | null = null
  for (const t of asig.temas) {
    const p = parecido(tituloParte, t.nombre)
    if (!mejor || p > mejor.p) mejor = { id: t.id, p }
  }
  return mejor && mejor.p >= 0.6 ? { subjectId: asig.id, topicId: mejor.id } : elegida
}

/** «Reumatología › Lupus eritematoso sistémico», «Reumatología › General» o «Sin clasificar». */
export function nombreCarpeta(arbol: AsignaturaCatalogo[] | null, c: Carpeta, { corto = false } = {}): string {
  if (c.subjectId === null) return 'Sin clasificar'
  const a = arbol?.find((x) => x.id === c.subjectId)
  if (!a) return 'Carpeta'
  const asig = corto ? a.nombreCorto : a.nombre
  if (c.topicId === null) return `${asig} › General`
  const t = a.temas.find((x) => x.id === c.topicId)
  return t ? `${asig} › ${t.nombre}` : `${asig} › General`
}

/** Los textos de un documento con sus pesos: el título pesa 3; las demás listas, 2 en total cada una. */
export function textosDocumento(titulo: string, ...listas: (string | null | undefined)[][]): TextoPonderado[] {
  const out: TextoPonderado[] = [{ texto: titulo, peso: 3 }]
  for (const lista of listas) {
    const limpias = lista.filter((x): x is string => !!x && x.trim().length > 1)
    for (const texto of limpias) out.push({ texto, peso: 2 / limpias.length })
  }
  return out
}
