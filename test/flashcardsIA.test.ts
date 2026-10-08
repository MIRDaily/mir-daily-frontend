// Flashcards con IA (navegador): saneado de lo que manda el servidor, vista previa por tema y nivel,
// lo que se guarda y la rama de un mapa (con las filas de sus tablas) como fuente.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  agrupar,
  borradores,
  contarNiveles,
  mapaParaFlashcards,
  origenTexto,
  paraGuardar,
  sanitizeTarjetas,
  tarjetasAprox,
  tarjetasAproxMapa,
} from '@/lib/flashcards/ia/tarjetas'
import type { NodoMapa } from '@/lib/mapas/ia/rama'

test('sanitizeTarjetas: solo lo conocido, nivel 1-4 y texto acotado', () => {
  const r = sanitizeTarjetas([
    { tema: 'ACG', nivel: 2, pregunta: '¿Biopsia?', respuesta: 'Arteria temporal', ia: { anclaje: 0.9, pagina: 3, dudoso: 'tratamiento', script: 'x' } },
    { tema: 'ACG', nivel: 5, pregunta: '¿x?', respuesta: 'y' },
    { tema: 'ACG', nivel: 1, pregunta: '', respuesta: 'y' },
    { nivel: 4, pregunta: `  ¿Larga?  ${'a'.repeat(400)}`, respuesta: 'r', ia: { anclaje: 7, dudoso: 'otro' } },
    'basura',
    null,
  ])
  assert.equal(r.length, 2)
  assert.deepEqual(r[0], { tema: 'ACG', nivel: 2, pregunta: '¿Biopsia?', respuesta: 'Arteria temporal', ia: { anclaje: 0.9, pagina: 3, dudoso: 'tratamiento' } })
  assert.equal(r[1].tema, 'General')
  assert.equal(r[1].pregunta.length, 300)
  assert.equal(r[1].ia, undefined)
  assert.deepEqual(sanitizeTarjetas({ no: 'es lista' }), [])
})

test('agrupar: por tema en su orden y por nivel de fácil a demencial, con índices editables', () => {
  const lista = borradores([
    { tema: 'ACG', nivel: 3, pregunta: 'p1', respuesta: 'r' },
    { tema: 'Takayasu', nivel: 1, pregunta: 'p2', respuesta: 'r' },
    { tema: 'ACG', nivel: 1, pregunta: 'p3', respuesta: 'r' },
    { tema: 'ACG', nivel: 3, pregunta: 'p4', respuesta: 'r' },
  ])
  assert.deepEqual(agrupar(lista), [
    { tema: 'ACG', niveles: [{ nivel: 1, indices: [2] }, { nivel: 3, indices: [0, 3] }] },
    { tema: 'Takayasu', niveles: [{ nivel: 1, indices: [1] }] },
  ])
})

test('paraGuardar y contarNiveles: solo las marcadas y con texto', () => {
  const lista = borradores([
    { tema: 'ACG', nivel: 4, pregunta: ' ¿Edad? ', respuesta: ' >50 años ' },
    { tema: 'ACG', nivel: 2, pregunta: '¿Biopsia?', respuesta: 'Temporal' },
    { tema: 'ACG', nivel: 2, pregunta: '¿Vacía?', respuesta: '' },
  ])
  lista[1].incluir = false
  assert.deepEqual(paraGuardar(lista), [{ front: '¿Edad?', back: '>50 años', topic: 'ACG', level: 4 }])
  assert.deepEqual(contarNiveles(lista), { 1: 0, 2: 1, 3: 0, 4: 1 })
  assert.deepEqual(contarNiveles(lista, false), { 1: 0, 2: 2, 3: 0, 4: 1 })
})

test('borradores: el tema del libro va en cada borrador', () => {
  const b = borradores([{ tema: 'Gota', nivel: 1, pregunta: 'p', respuesta: 'r' }], 't3-', 'Tema 2. Microcristales')
  assert.equal(b[0].key, 't3-0')
  assert.equal(b[0].grupo, 'Tema 2. Microcristales')
})

test('origenTexto y estimaciones', () => {
  assert.equal(origenTexto({ pagina: 12 }), 'pág. 12')
  assert.equal(origenTexto({ diapositiva: 4 }), 'diapositiva 4')
  assert.equal(origenTexto(undefined), '')
  // Vasculitis (83.700 car.) en normal con los 4 niveles: el banco dio 141 y 125.
  const v = tarjetasAprox(83700, 'normal', 4)
  assert.ok(v >= 110 && v <= 140, `vasculitis ≈ ${v}`)
  assert.ok(tarjetasAprox(83700, 'normal', 1) < v)
  assert.ok(tarjetasAprox(83700, 'pocas') < v && tarjetasAprox(83700, 'muchas') > v)
  assert.equal(tarjetasAproxMapa(10, 'normal'), 14)
})

const nodo = (id: string, label: string, parentId: string | undefined, y: number, extra: Partial<NodoMapa['data']> = {}): NodoMapa => ({
  id,
  position: { x: 0, y },
  data: { label, parentId, style: {} as NodoMapa['data']['style'], ...extra },
})

test('mapaParaFlashcards: la rama sangrada, cada tabla con una línea por fila, hojas y páginas', () => {
  const nodes: NodoMapa[] = [
    nodo('r', 'Vasculitis', undefined, 0),
    nodo('b', '<b>Grandes vasos</b>', 'r', 10),
    nodo('acg', 'Arteritis de células gigantes', 'b', 20),
    nodo('h1', 'Clínica: cefalea temporal', 'acg', 30, { ia: { anclaje: 1, pagina: 4 } }),
    nodo('t', '', 'acg', 40, {
      table: { title: 'Diagnóstico diferencial', columns: ['', 'ACG', 'Takayasu'], rows: [['Edad', '>50', '<40'], ['Sexo', '', '']] },
    }),
    nodo('tak', 'Arteritis de Takayasu', 'b', 50),
    nodo('h2', 'Clínica: pulsos ausentes', 'tak', 60, { ia: { anclaje: 1, pagina: 6 } }),
  ]
  const r = mapaParaFlashcards(nodes, 'b')!
  assert.deepEqual(r.mapa, [
    { d: 0, t: 'Grandes vasos' },
    { d: 1, t: 'Arteritis de células gigantes' },
    { d: 2, t: 'Clínica: cefalea temporal' },
    { d: 2, t: 'Diagnóstico diferencial' },
    { d: 3, t: 'Edad — ACG: >50; Takayasu: <40' },
    { d: 1, t: 'Arteritis de Takayasu' },
    { d: 2, t: 'Clínica: pulsos ausentes' },
  ])
  assert.equal(r.hojas, 3)
  assert.deepEqual(r.paginas, [4, 6])
  assert.equal(r.titulo, 'Grandes vasos')
  assert.equal(mapaParaFlashcards(nodes, 'no-existe'), null)
})
