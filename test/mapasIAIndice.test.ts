// «Qué parte usar» (informe 76): índice del documento (marcadores, temas, apartados, títulos,
// páginas), rangos de páginas y selección.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  alternarEntrada,
  construirIndice,
  detectarTemas,
  estadoEntrada,
  leerRango,
  rangoLabel,
  resumenSeleccion,
  seccionesDePaginas,
} from '@/lib/mapas/ia/indice'
import type { Seccion } from '@/lib/mapas/ia/types'

const pag = (n: number, texto: string): Seccion => ({ texto, pagina: n })

// Un libro como el de AMIR: cada tema empieza página y las impares repiten «Tema N  Título».
const LIBRO: Seccion[] = [
  pag(1, '1\nManual AMIR Reumatología\nÍndice'),
  pag(2, '2\nTema 1\nIntroducción\nAutores: X.\nTexto de la introducción'),
  pag(3, '3\nTema 1  Introducción\n1.1. Anamnesis\nTexto'),
  pag(4, '4\nManual AMIR\nTema 2\nArtritis por microcristales\nTexto'),
  pag(5, '5\nTema 2  Artritis por microcristales\n2.1. Gota\nTexto de gota\n2.2. Condrocalcinosis\nMás'),
  pag(6, '6\nTema 3\nVasculitis\nTexto'),
]

test('detectarTemas: un tema empieza en la primera página con su número; la cabecera repetida no abre otro', () => {
  const t = detectarTemas(LIBRO)
  assert.deepEqual(
    t.filter((x) => x.nivel === 1).map((x) => [x.titulo, x.pagina]),
    [['Tema 1. Introducción', 2], ['Tema 2. Artritis por microcristales', 4], ['Tema 3. Vasculitis', 6]],
  )
  assert.deepEqual(
    t.filter((x) => x.nivel === 2).map((x) => [x.titulo, x.pagina]),
    [['1.1. Anamnesis', 3], ['2.1. Gota', 5], ['2.2. Condrocalcinosis', 5]],
  )
})

test('detectarTemas: un título partido en dos líneas se completa con la siguiente', () => {
  const t = detectarTemas([
    pag(1, '47\nTema 5\nEnfermedad de Still y\nartritis idiopática juvenil\nAutores: X'),
    pag(2, '48\n5.1. Diagnóstico diferencial de los\ncuadros febriles\nTexto'),
  ])
  assert.deepEqual(t.map((x) => x.titulo), ['Tema 5. Enfermedad de Still y artritis idiopática juvenil', '5.1. Diagnóstico diferencial de los cuadros febriles'])
})

test('construirIndice: temas con sus rangos, el inicio del documento y los caracteres', () => {
  const idx = construirIndice(LIBRO)
  const temas = idx.filter((e) => e.nivel === 1)
  assert.deepEqual(
    temas.map((e) => [e.titulo, e.paginaDesde, e.paginaHasta]),
    [['Inicio del documento', 1, 1], ['Tema 1. Introducción', 2, 3], ['Tema 2. Artritis por microcristales', 4, 5], ['Tema 3. Vasculitis', 6, 6]],
  )
  // Dos apartados en la misma página: la comparten.
  const gota = idx.find((e) => e.titulo === '2.1. Gota')!
  assert.equal(gota.paginaDesde, 5)
  assert.equal(gota.paginaHasta, 5)
  const total = LIBRO.reduce((n, s) => n + s.texto.length, 0)
  assert.equal(temas.reduce((n, e) => n + e.caracteres, 0), total)
})

test('construirIndice: con marcadores del PDF, mandan ellos', () => {
  const idx = construirIndice(LIBRO, [
    { titulo: 'Primera parte', pagina: 1 },
    { titulo: 'Segunda parte', pagina: 4 },
  ])
  assert.deepEqual(idx.map((e) => [e.titulo, e.desde, e.hasta]), [['Primera parte', 0, 2], ['Segunda parte', 3, 5]])
})

test('construirIndice: Word/PowerPoint por sus títulos; las secciones sin título se suman a la anterior', () => {
  const idx = construirIndice([
    { titulo: 'Concepto', texto: 'abc' },
    { texto: 'def' },
    { titulo: 'Tratamiento:', texto: '2.1. Algo que parece apartado\nghi' },
  ])
  assert.deepEqual(idx.map((e) => [e.titulo, e.desde, e.hasta, e.caracteres]), [['Concepto', 0, 1, 14], ['Tratamiento', 2, 2, 45]])
})

test('construirIndice: sin estructura, una entrada por página sin cabeceras ni pies repetidos', () => {
  const pie = (n: number) => `ec-europe - ISBN 978-84 - ${n}`
  const idx = construirIndice([
    pag(1, `${pie(1)}\nURGENCIAS UROLÓGICAS\nTexto`),
    pag(2, `${pie(2)}\n12\nEtiología\nTexto`),
    pag(3, `${pie(3)}\nDiagnóstico\nTexto`),
  ])
  assert.deepEqual(idx.map((e) => e.titulo), ['URGENCIAS UROLÓGICAS', 'Etiología', 'Diagnóstico'])
})

test('leerRango: rangos, sueltas, guiones largos; null si no se entiende o se sale', () => {
  assert.deepEqual([...leerRango('3-5, 8', 10)!], [3, 4, 5, 8])
  assert.deepEqual([...leerRango(' 2 – 3 ; 9 ', 10)!], [2, 3, 9])
  assert.deepEqual([...leerRango('9-40', 10)!], [9, 10])
  assert.equal(leerRango('', 10), null)
  assert.equal(leerRango('abc', 10), null)
  assert.equal(leerRango('5-3', 10), null)
  assert.equal(leerRango('11', 10), null)
})

test('selección: marcar un tema marca su rango; el estado es todo, parte o nada', () => {
  const idx = construirIndice(LIBRO)
  const tema2 = idx.find((e) => e.titulo.startsWith('Tema 2'))!
  let sel = alternarEntrada(tema2, new Set())
  assert.deepEqual([...sel].sort(), [3, 4])
  assert.equal(estadoEntrada(tema2, sel), 'todo')
  const gota = idx.find((e) => e.titulo === '2.1. Gota')!
  assert.equal(estadoEntrada(gota, sel), 'todo')
  sel = alternarEntrada(gota, sel)
  assert.equal(estadoEntrada(tema2, sel), 'parte')
  sel = alternarEntrada(tema2, sel)
  assert.equal(estadoEntrada(tema2, sel), 'todo')
  sel = alternarEntrada(tema2, sel)
  assert.equal(sel.size, 0)
})

test('resumenSeleccion: solo lo marcado, en orden; páginas reales o estimadas en Word', () => {
  const sel = seccionesDePaginas(LIBRO, new Set([6, 2]))
  const r = resumenSeleccion(LIBRO, sel)
  assert.deepEqual(r.elegidas.map((s) => s.pagina), [2, 6])
  assert.equal(r.paginas, 2)
  assert.equal(r.caracteres, LIBRO[1].texto.length + LIBRO[5].texto.length)
  const word = resumenSeleccion([{ titulo: 'A', texto: 'x'.repeat(5000) }, { titulo: 'B', texto: 'y' }], new Set([0]))
  assert.equal(word.paginas, 2)
})

test('rangoLabel: páginas o diapositivas', () => {
  const idx = construirIndice(LIBRO)
  assert.equal(rangoLabel(idx[1]), 'págs. 2–3')
  assert.equal(rangoLabel(idx[0], 'diapositiva'), 'diap. 1')
})
