// Títulos de un PDF por su LETRA (17/10/2026): cuando el PDF no trae marcadores ni temas «Tema N»
// numerados (un tema suelto, como los de AMIR), el índice de «Qué parte usar» salía con una entrada por
// página titulada con su primera línea, que casi siempre es el final de una frase de la página anterior.
// Aquí se buscan los títulos de verdad: líneas más grandes que el cuerpo del texto. Puro (sin pdf.js):
// recibe lo que pdf.js da de cada trozo de texto y se prueba con `npm test`.
//
// Reglas (comprobadas con los temas de Reumatología de AMIR: cuerpo a 9 pt, título del tema a 25 y 19,
// apartados a 11 y cajas o subapartados a 10,5):
//   - cuerpo = el tamaño con más caracteres; título = línea corta al menos un 15 % más grande;
//   - los tamaños que solo salen en la primera página, una o dos veces, son el título del documento;
//   - de los demás, el MAYOR es el de los apartados (los más pequeños, como «Regla mnemotécnica» o
//     «ENFOQUE MIR», son cajas y subapartados: no entran);
//   - un título partido en dos o tres líneas seguidas del mismo tamaño se une;
//   - si hay apartados numerados («6.1. Lupus»), esos son el nivel 1 y lo que cuelga de ellos, el 2; lo
//     de antes del primero numerado (Etiopatogenia, Clasificación…) también es nivel 1.

export type TrozoPdf = {
  str: string
  /** Altura de la letra (hypot de transform[2], transform[3]). */
  alto: number
  fuente: string
  /** Altura en la página (transform[5]: crece hacia arriba). */
  y: number
}

export type Encabezado = { titulo: string; pagina: number; nivel: 1 | 2 }

type Linea = { texto: string; alto: number; fuente: string; y: number; pagina: number }

const redondear = (n: number) => Math.round(n * 10) / 10
const MAX_TITULO = 120
const RE_NUMERADO = /^\d{1,3}\.\d{1,2}\.?\s/
const sinNumeros = (l: string) => l.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()

/** Trozos de cada página → líneas (trozos seguidos a la misma altura, con la misma letra). */
function lineas(paginas: TrozoPdf[][]): Linea[] {
  const out: Linea[] = []
  paginas.forEach((trozos, p) => {
    let actual: Linea | null = null
    for (const t of trozos) {
      if (!t.str) continue
      const alto = redondear(t.alto)
      if (actual && actual.fuente === t.fuente && actual.alto === alto && Math.abs(actual.y - t.y) < alto * 0.5) {
        actual.texto += t.str
        continue
      }
      if (!t.str.trim()) continue
      actual = { texto: t.str, alto, fuente: t.fuente, y: t.y, pagina: p + 1 }
      out.push(actual)
    }
  })
  for (const l of out) l.texto = l.texto.replace(/\s+/g, ' ').trim()
  return out.filter((l) => l.texto)
}

export function detectarEncabezados(paginas: TrozoPdf[][]): Encabezado[] {
  const todas = lineas(paginas)
  if (todas.length === 0) return []

  // Cuerpo del texto: el tamaño con más caracteres.
  const porAlto = new Map<number, number>()
  for (const l of todas) porAlto.set(l.alto, (porAlto.get(l.alto) ?? 0) + l.texto.length)
  const cuerpo = [...porAlto].sort((a, b) => b[1] - a[1])[0][0]

  // Cabeceras y pies: el mismo texto A LA MISMA ALTURA en muchas páginas. Un apartado que se repite
  // («Diagnóstico» en cada enfermedad de un tema) cae cada vez en un sitio distinto y sí es un título.
  const clave = (l: Linea) => `${sinNumeros(l.texto)}|${Math.round(l.y / 6)}`
  const enPaginas = new Map<string, Set<number>>()
  for (const l of todas) {
    const k = clave(l)
    if (!enPaginas.has(k)) enPaginas.set(k, new Set())
    enPaginas.get(k)!.add(l.pagina)
  }
  const repetida = (l: Linea) => paginas.length >= 3 && (enPaginas.get(clave(l))?.size ?? 0) >= Math.max(3, paginas.length * 0.3)

  const candidatas = new Set(
    todas.filter((l) => l.alto >= cuerpo * 1.15 && l.texto.length <= 100 && /\p{L}{3}/u.test(l.texto) && !repetida(l)),
  )
  if (candidatas.size === 0) return []

  // Tamaños del título del documento: solo en la primera página con texto, una o dos líneas.
  const primera = todas[0].pagina
  const tamanos = [...new Set([...candidatas].map((l) => l.alto))].sort((a, b) => b - a)
  const deTitulo = new Set(
    tamanos.filter((a) => {
      const ls = [...candidatas].filter((l) => l.alto === a)
      return ls.length <= 2 && ls.every((l) => l.pagina === primera)
    }),
  )
  const principal = tamanos.find((a) => !deTitulo.has(a))
  if (principal === undefined) return []

  // Los títulos de ese tamaño, uniendo los que siguen en la línea de debajo (misma página y letra).
  const titulos: { texto: string; pagina: number }[] = []
  let previa: Linea | null = null
  for (const l of todas) {
    const esTitulo = l.alto === principal && candidatas.has(l)
    if (!esTitulo) {
      previa = null
      continue
    }
    const pegada =
      previa !== null &&
      previa.pagina === l.pagina &&
      previa.fuente === l.fuente &&
      previa.y - l.y > 0 &&
      previa.y - l.y <= l.alto * 1.6 &&
      !RE_NUMERADO.test(l.texto)
    if (pegada) titulos[titulos.length - 1].texto += ` ${l.texto}`
    else titulos.push({ texto: l.texto, pagina: l.pagina })
    previa = l
  }

  // Nivel: con apartados numerados, ellos son el 1 y lo que cuelga de ellos, el 2.
  let visteNumerado = false
  return titulos.map((t) => {
    const numerado = RE_NUMERADO.test(t.texto)
    if (numerado) visteNumerado = true
    return {
      titulo: t.texto.replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO),
      pagina: t.pagina,
      nivel: numerado || !visteNumerado ? 1 : 2,
    }
  })
}
