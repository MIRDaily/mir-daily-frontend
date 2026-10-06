// Tablas de un PDF leídas con su estructura. pdf.js da el texto suelto, con su posición: una
// tabla llega columna tras columna («Aguja Romboidal pequeño Muy pequeños…») y el modelo tenía
// que adivinar qué celda iba con cuál (en microcristales cruzó la localización de la
// hidroxiapatita y el oxalato). Aquí se reconstruye la rejilla a partir de lo DIBUJADO en la
// página y cada trozo de texto va a la celda que lo contiene; la tabla sale como filas
// «celda | celda», igual que las de Word y PowerPoint.
//
// Las tablas de AMIR (y muchas otras) no tienen líneas: cada celda es un rectángulo de fondo
// (gris la cabecera, crema el cuerpo) separado del resto por un hueco blanco. También se
// aceptan rejillas de rectángulos con borde. Un grupo de rectángulos solo cuenta como tabla si
// forma una rejilla regular (sus bordes caen en unas pocas columnas y filas que casi cubren);
// un diagrama de cajas no la forma.
//
// Módulo puro (sin DOM ni pdf.js): recibe la lista de operaciones y el texto de la página.

/** Códigos de pdf.js que se usan (se pasan desde fuera: `pdfjs.OPS`). */
export type CodigosPdf = {
  save: number
  restore: number
  transform: number
  constructPath: number
  paintFormXObjectBegin: number
  paintFormXObjectEnd: number
  setFillRGBColor: number
  fill: number
  eoFill: number
  fillStroke: number
  eoFillStroke: number
  closeFillStroke: number
  closeEOFillStroke: number
  stroke: number
  closeStroke: number
}

export type ItemTexto = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }

type Caja = { x0: number; y0: number; x1: number; y1: number }
type Matriz = [number, number, number, number, number, number]

export type TablaPdf = {
  caja: Caja
  filas: string[][]
}

// Órdenes de las rutas de pdf.js 5 (DrawOPS): moveTo, lineTo, curveTo, quadraticCurveTo, closePath.
const MOVE = 0
const LINE = 1
const CURVE = 2
const QUAD = 3
const CLOSE = 4

const TOL = 2.5 // pt: bordes que se consideran el mismo
const HUECO = 4 // pt: rectángulos a esta distancia o menos son de la misma tabla
const MIN_CELDA = 5 // pt

const mult = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const aplicar = (m: Matriz, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

function matriz(v: unknown): Matriz | null {
  if (!v || typeof v !== 'object') return null
  const a = Array.from(v as ArrayLike<number>)
  return a.length >= 6 && a.every((x) => Number.isFinite(x)) ? (a.slice(0, 6) as Matriz) : null
}

/** Rectángulos alineados con los ejes de una ruta (subrutas de 4 esquinas), en coordenadas de página. */
function rectangulos(ruta: ArrayLike<number>, m: Matriz): Caja[] {
  const out: Caja[] = []
  let puntos: [number, number][] = []
  let ok = true
  const cerrar = () => {
    // 4 esquinas (o 5 con la vuelta al inicio), solo tramos rectos y alineados con los ejes.
    let p = puntos
    if (p.length === 5 && Math.abs(p[0][0] - p[4][0]) < 0.01 && Math.abs(p[0][1] - p[4][1]) < 0.01) p = p.slice(0, 4)
    if (ok && p.length === 4) {
      const alineado = p.every((a, i) => {
        const b = p[(i + 1) % 4]
        return Math.abs(a[0] - b[0]) < 0.5 || Math.abs(a[1] - b[1]) < 0.5
      })
      if (alineado) {
        const xs = p.map((q) => q[0])
        const ys = p.map((q) => q[1])
        out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })
      }
    }
    puntos = []
    ok = true
  }
  for (let i = 0; i < ruta.length; ) {
    const op = ruta[i]
    if (op === MOVE) {
      if (puntos.length) cerrar()
      puntos.push(aplicar(m, ruta[i + 1], ruta[i + 2]))
      i += 3
    } else if (op === LINE) {
      puntos.push(aplicar(m, ruta[i + 1], ruta[i + 2]))
      i += 3
    } else if (op === CURVE) {
      ok = false
      i += 7
    } else if (op === QUAD) {
      ok = false
      i += 5
    } else if (op === CLOSE) {
      cerrar()
      i += 1
    } else {
      break // formato desconocido: mejor no inventar
    }
  }
  if (puntos.length) cerrar()
  return out
}

/** Rectángulos pintados de la página (rellenos no blancos, o con borde), en coordenadas de página. */
export function cajasDibujadas(fnArray: number[], argsArray: unknown[], C: CodigosPdf): Caja[] {
  const out: Caja[] = []
  const pila: Matriz[] = []
  let ctm: Matriz = [1, 0, 0, 1, 0, 0]
  let relleno = '#000000'
  const pilaColor: string[] = []
  const rellenos = new Set([C.fill, C.eoFill, C.fillStroke, C.eoFillStroke, C.closeFillStroke, C.closeEOFillStroke])
  const trazos = new Set([C.stroke, C.closeStroke])
  for (let i = 0; i < fnArray.length; i++) {
    const f = fnArray[i]
    const a = argsArray[i] as unknown[] | null
    if (f === C.save) {
      pila.push(ctm)
      pilaColor.push(relleno)
    } else if (f === C.restore) {
      ctm = pila.pop() ?? ctm
      relleno = pilaColor.pop() ?? relleno
    } else if (f === C.transform) {
      const m = matriz(a)
      if (m) ctm = mult(ctm, m)
    } else if (f === C.paintFormXObjectBegin) {
      pila.push(ctm)
      pilaColor.push(relleno)
      const m = matriz(a?.[0])
      if (m) ctm = mult(ctm, m)
    } else if (f === C.paintFormXObjectEnd) {
      ctm = pila.pop() ?? ctm
      relleno = pilaColor.pop() ?? relleno
    } else if (f === C.setFillRGBColor) {
      if (typeof a?.[0] === 'string') relleno = a[0]
    } else if (f === C.constructPath && Array.isArray(a)) {
      const pinta = a[0] as number
      // También los rellenos blancos: hay tablas con celdas blancas (el tratamiento del lupus). El
      // fondo blanco de la página o de un recuadro contiene a otros rectángulos y lo descarta
      // `grupos` como contenedor.
      const relle = rellenos.has(pinta)
      const traza = trazos.has(pinta) || pinta === C.fillStroke || pinta === C.eoFillStroke
      if (!relle && !traza) continue
      const datos = (a[1] as unknown[] | undefined)?.[0]
      if (!datos || typeof datos !== 'object') continue
      for (const r of rectangulos(datos as ArrayLike<number>, ctm)) {
        if (r.x1 - r.x0 >= MIN_CELDA && r.y1 - r.y0 >= MIN_CELDA) out.push(r)
      }
    }
  }
  return out
}

/** Valores que están a menos de TOL se funden en uno (su media). */
function agrupar(valores: number[]): number[] {
  const v = valores.slice().sort((a, b) => a - b)
  const out: number[][] = []
  for (const x of v) {
    const ultimo = out[out.length - 1]
    if (ultimo && x - ultimo[ultimo.length - 1] <= TOL) ultimo.push(x)
    else out.push([x])
  }
  return out.map((g) => g.reduce((s, x) => s + x, 0) / g.length)
}

const cerca = (a: Caja, b: Caja) =>
  a.x0 <= b.x1 + HUECO && b.x0 <= a.x1 + HUECO && a.y0 <= b.y1 + HUECO && b.y0 <= a.y1 + HUECO

/** Grupos de rectángulos que se tocan (o casi): candidatos a tabla. */
function grupos(cajas: Caja[]): Caja[][] {
  // Un rectángulo que contiene a otros (fondo de un recuadro, marco de la tabla) no es una celda.
  const celdas = cajas.filter(
    (c) => !cajas.some((o) => o !== c && o.x0 >= c.x0 - 0.5 && o.x1 <= c.x1 + 0.5 && o.y0 >= c.y0 - 0.5 && o.y1 <= c.y1 + 0.5 && (o.x1 - o.x0) * (o.y1 - o.y0) < (c.x1 - c.x0) * (c.y1 - c.y0) * 0.9),
  )
  const padre = celdas.map((_, i) => i)
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])))
  for (let i = 0; i < celdas.length; i++) {
    for (let j = i + 1; j < celdas.length; j++) if (cerca(celdas[i], celdas[j])) padre[raiz(i)] = raiz(j)
  }
  const mapa = new Map<number, Caja[]>()
  celdas.forEach((c, i) => {
    const r = raiz(i)
    mapa.set(r, [...(mapa.get(r) ?? []), c])
  })
  return [...mapa.values()]
}

type Rejilla = { xs: number[]; ys: number[]; celdas: Caja[]; caja: Caja; dueño: (number | null)[][] }

/**
 * ¿Forman estos rectángulos una rejilla? Columnas y filas salen de sus bordes; cada hueco de la
 * rejilla debe quedar cubierto por un rectángulo (una celda combinada cubre varios). Exige al
 * menos 2×2 y que casi todo esté cubierto: un diagrama de cajas sueltas no pasa.
 */
function rejilla(celdas: Caja[]): Rejilla | null {
  if (celdas.length < 4) return null
  const xs = agrupar(celdas.flatMap((c) => [c.x0, c.x1]))
  const ys = agrupar(celdas.flatMap((c) => [c.y0, c.y1]))
  // Bordes pegados (el hueco blanco entre dos celdas) no son una columna: se quitan las franjas
  // de menos de MIN_CELDA de ancho.
  const limpiar = (v: number[]) => v.filter((x, i) => i === 0 || x - v[i - 1] >= MIN_CELDA)
  const X = limpiar(xs)
  const Y = limpiar(ys).reverse() // de arriba (y mayor) a abajo
  const cols = X.length - 1
  const filas = Y.length - 1
  if (cols < 2 || filas < 2 || cols > 12 || filas > 60) return null
  const dueño: (number | null)[][] = []
  let cubiertas = 0
  for (let r = 0; r < filas; r++) {
    const fila: (number | null)[] = []
    const cy = (Y[r] + Y[r + 1]) / 2
    for (let c = 0; c < cols; c++) {
      const cx = (X[c] + X[c + 1]) / 2
      const k = celdas.findIndex((q) => cx >= q.x0 - TOL && cx <= q.x1 + TOL && cy >= q.y0 - TOL && cy <= q.y1 + TOL)
      fila.push(k >= 0 ? k : null)
      if (k >= 0) cubiertas++
    }
    dueño.push(fila)
  }
  if (cubiertas / (cols * filas) < 0.85) return null
  const caja = { x0: X[0], x1: X[cols], y0: Y[filas], y1: Y[0] }
  return { xs: X, ys: Y, celdas, caja, dueño }
}

/** Centro de un trozo de texto, también girado (las etiquetas verticales de una columna de grupo). */
const centro = (it: ItemTexto): [number, number] => {
  const [a, b, c, d, e, f] = it.transform
  const escala = Math.hypot(a, b) || 1
  const ux = a / escala // dirección del texto
  const uy = b / escala
  const alto = it.height || Math.hypot(c, d) || 8
  const ancho = it.width || 0
  return [e + (ux * ancho) / 2 - (uy * alto) * 0.35, f + (uy * ancho) / 2 + (ux * alto) * 0.35]
}

const dentro = (x: number, y: number, c: Caja, margen = 0) =>
  x >= c.x0 - margen && x <= c.x1 + margen && y >= c.y0 - margen && y <= c.y1 + margen

/**
 * Tablas de la página: rejillas de rectángulos con su texto. Devuelve las tablas y, por cada
 * trozo de texto, a qué tabla pertenece (-1 si a ninguna).
 */
export function detectarTablas(cajas: Caja[], items: ItemTexto[]): { tablas: TablaPdf[]; deTabla: number[] } {
  const deTabla = items.map(() => -1)
  const tablas: TablaPdf[] = []
  for (const g of grupos(cajas)) {
    const rj = rejilla(g)
    if (!rj) continue
    const filas = rj.ys.length - 1
    const cols = rj.xs.length - 1
    // Texto de cada rectángulo (celda real), en orden de lectura.
    const textos: { y: number; x: number; h: number; s: string }[][] = rj.celdas.map(() => [])
    let usados = 0
    const idx: number[] = []
    items.forEach((it, i) => {
      if (deTabla[i] !== -1 || !it.str.trim()) return
      const [x, y] = centro(it)
      if (!dentro(x, y, rj.caja, 1)) return
      let k = rj.celdas.findIndex((q) => dentro(x, y, q, 0.5))
      if (k < 0) {
        // En un hueco entre celdas: la más cercana.
        let mejor = Infinity
        rj.celdas.forEach((q, j) => {
          const d = Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.y0 - y, 0, y - q.y1))
          if (d < mejor) {
            mejor = d
            k = j
          }
        })
      }
      textos[k].push({ y: it.transform[5], x: it.transform[4], h: it.height || Math.abs(it.transform[3]) || 8, s: it.str })
      idx.push(i)
      usados++
    })
    // Sin texto (o casi) no es una tabla: un fondo de color decorativo.
    if (usados < 4) continue
    const textoDe = (k: number) => {
      // Por líneas (de arriba abajo) y cada línea de izquierda a derecha. Un superíndice («mm³») o
      // una marca «(MIR)» va un poco más alta: con una tolerancia de media letra sigue en su línea
      // (ordenar solo por altura lo ponía delante de la frase).
      const lineas: { y: number; h: number; partes: { x: number; s: string }[] }[] = []
      for (const p of textos[k].slice().sort((a, b) => b.y - a.y)) {
        const l = lineas.find((q) => Math.abs(q.y - p.y) <= Math.max(q.h, p.h) * 0.5)
        if (l) l.partes.push(p)
        else lineas.push({ y: p.y, h: p.h, partes: [p] })
      }
      return lineas
        .sort((a, b) => b.y - a.y)
        .map((l) => l.partes.sort((a, b) => a.x - b.x).map((q) => q.s).join(' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*\|\s*/g, ' / ')
        .replace(/\s+([.,;:)])/g, '$1')
        .replace(/\(\s+/g, '(')
        .trim()
    }
    const vistas = new Set<number>()
    let tabla: string[][] = []
    for (let r = 0; r < filas; r++) {
      const fila: string[] = []
      for (let c = 0; c < cols; c++) {
        const k = rj.dueño[r][c]
        // Celda combinada: el texto en su primera casilla; el resto, vacías.
        if (k === null || vistas.has(k)) fila.push('')
        else {
          vistas.add(k)
          fila.push(textoDe(k))
        }
      }
      tabla.push(fila)
    }
    // Filas y columnas sin nada fuera.
    tabla = tabla.filter((f) => f.some(Boolean))
    const conTexto = tabla[0]?.map((_, c) => tabla.some((f) => f[c])) ?? []
    tabla = tabla.map((f) => f.filter((_, c) => conTexto[c]))
    if (tabla.length < 2 || (tabla[0]?.length ?? 0) < 2) continue
    const n = tablas.length
    for (const i of idx) deTabla[i] = n
    tablas.push({ caja: rj.caja, filas: tabla })
  }
  return { tablas, deTabla }
}

/**
 * Texto de la página en el orden en que llega, con cada tabla sustituida por sus filas
 * «celda | celda» en el sitio donde empezaba.
 */
export function componerTexto(items: ItemTexto[], tablas: TablaPdf[], deTabla: number[]): string {
  let texto = ''
  let ultimaY: number | null = null
  const puestas = new Set<number>()
  items.forEach((item, i) => {
    const t = deTabla[i] ?? -1
    if (t >= 0) {
      if (puestas.has(t)) return
      puestas.add(t)
      texto += (texto && !texto.endsWith('\n') ? '\n' : '') + tablas[t].filas.map((f) => f.join(' | ')).join('\n') + '\n'
      ultimaY = null
      return
    }
    const y = item.transform[5]
    if (ultimaY !== null && Math.abs(y - ultimaY) > 2) texto += '\n'
    else if (texto && !texto.endsWith(' ') && !texto.endsWith('\n')) texto += ' '
    texto += item.str
    ultimaY = y
  })
  return texto
}
