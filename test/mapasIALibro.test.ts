// Documento largo tema a tema (informe 76): lo que manda el navegador para el índice, saneado de
// los temas del servidor, qué se envía a generar, el mapa grande con los temas plegados y los
// eventos de progreso.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  entradasDeTemas,
  INICIO_INDICE,
  nodosLibro,
  resumenParaIndice,
  sanitizeTemas,
  temasParaEnviar,
  unirTemas,
  type TemaIndice,
} from '@/lib/mapas/ia/libro'
import { aplicarEvento, arbolLibro, leerEvento, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { sanitizeDoc } from '@/lib/mapas/tree'
import { treeToGraph } from '@/lib/mapas/graph'
import type { Seccion } from '@/lib/mapas/ia/types'
import type { MapDoc } from '@/lib/mapas/types'

const SECS: Seccion[] = [
  { texto: 'Portada', pagina: 1 },
  { texto: 'Tema 1\nGota\n' + 'a'.repeat(1000), pagina: 2 },
  { texto: 'Tema 1  Gota\nmás', pagina: 3 },
  { texto: 'Tema 2\nVasculitis\n' + 'b'.repeat(500), pagina: 4 },
]
const TEMAS: TemaIndice[] = [
  { titulo: 'Tema 1. Gota', desde: 1, hasta: 2, chars: 0, apartados: [{ titulo: '1.1. Clínica', desde: 2 }] },
  { titulo: 'Tema 2. Vasculitis', desde: 3, hasta: 3, chars: 0, apartados: [] },
]

test('resumenParaIndice: solo el principio de cada sección, su tamaño y su página', () => {
  const r = resumenParaIndice(SECS)
  assert.equal(r.length, 4)
  assert.ok(r[1].inicio.length <= INICIO_INDICE)
  assert.equal(r[1].chars, SECS[1].texto.length)
  assert.equal(r[3].pagina, 4)
  assert.ok(!JSON.stringify(r).includes('a'.repeat(INICIO_INDICE + 1)))
})

test('sanitizeTemas: fuera de rango, solapados o raros no pasan; apartados dentro de su tema', () => {
  const t = sanitizeTemas(
    [
      { titulo: 'Uno', desde: 0, hasta: 1, chars: 10, apartados: [{ titulo: 'Dentro', desde: 1 }, { titulo: 'Fuera', desde: 3 }] },
      { titulo: 'Solapa', desde: 1, hasta: 2 },
      { titulo: '<b>Dos</b>', desde: 2, hasta: 3 },
      { titulo: 'Más allá', desde: 3, hasta: 9 },
      'basura',
    ],
    4,
  )
  assert.deepEqual(t.map((x) => [x.titulo, x.desde, x.hasta]), [['Uno', 0, 1], ['<b>Dos</b>', 2, 3]])
  assert.deepEqual(t[0].apartados, [{ titulo: 'Dentro', desde: 1 }])
  assert.deepEqual(sanitizeTemas(null, 4), [])
})

test('entradasDeTemas: tema y apartados con sus páginas y caracteres', () => {
  const e = entradasDeTemas(TEMAS, SECS)
  assert.deepEqual(e.map((x) => [x.titulo, x.nivel, x.paginaDesde, x.paginaHasta]), [
    ['Tema 1. Gota', 1, 2, 3],
    ['1.1. Clínica', 2, 3, 3],
    ['Tema 2. Vasculitis', 1, 4, 4],
  ])
  assert.equal(e[0].caracteres, SECS[1].texto.length + SECS[2].texto.length)
})

test('temasParaEnviar: solo lo marcado dentro de un tema, con los rangos sobre lo enviado', () => {
  // Marcadas: la portada (fuera de todo tema), una página del tema 1 y el tema 2.
  const r = temasParaEnviar(SECS, new Set([0, 2, 3]), TEMAS)
  assert.deepEqual(r.secciones.map((s) => s.pagina), [3, 4])
  assert.deepEqual(r.temas, [
    { titulo: 'Tema 1. Gota', desde: 0, hasta: 0 },
    { titulo: 'Tema 2. Vasculitis', desde: 1, hasta: 1 },
  ])
  // Un tema sin nada marcado no viaja.
  assert.deepEqual(temasParaEnviar(SECS, new Set([3]), TEMAS).temas, [{ titulo: 'Tema 2. Vasculitis', desde: 0, hasta: 0 }])
})

test('nodosLibro: cada tema crece con la raíz de su texto', () => {
  assert.equal(nodosLibro([10000, 40000], 0.5), 50 + 100)
})

test('unirTemas: un mapa con cada tema plegado, ids únicos y lo de cada tema debajo', () => {
  const tema = (t: string): MapDoc => ({
    version: 1,
    nodes: [
      { id: 'n1', parentId: null, text: t, category: 'general' },
      { id: 'n2', parentId: 'n1', text: `${t} bloque`, category: 'general', ia: { anclaje: 1, pagina: 3 } },
      { id: 'n3', parentId: 'n2', text: 'Clínica: x', category: 'clinica' },
    ],
  })
  const doc = unirTemas('Reumatología', [{ titulo: 'Tema 1. Gota', doc: tema('Gota') }, { titulo: 'Tema 2', doc: tema('Vasculitis') }])
  assert.equal(doc.nodes.length, 1 + 3 + 3)
  assert.equal(new Set(doc.nodes.map((n) => n.id)).size, doc.nodes.length)
  const temas = doc.nodes.filter((n) => n.parentId === 'libro')
  assert.deepEqual(temas.map((n) => [n.text, n.collapsed]), [['Tema 1. Gota', true], ['Tema 2', true]])
  const bloque = doc.nodes.find((n) => n.text === 'Gota bloque')!
  assert.equal(bloque.parentId, temas[0].id)
  assert.deepEqual(bloque.ia, { anclaje: 1, pagina: 3 })
  // Pasa el saneado del editor sin perder nada, y al abrirlo cada tema sigue plegado.
  assert.equal(sanitizeDoc(doc).nodes.length, doc.nodes.length)
  const grafo = treeToGraph(doc)
  assert.deepEqual(
    grafo.nodes.filter((n) => n.data.parentId === 'libro').map((n) => n.data.collapsed),
    [true, true],
  )
  // Lo plegado tiene sitio propio: hacia fuera de su tema y sin amontonarse (antes, todo en 0,0).
  const pos = new Map(grafo.nodes.map((n) => [n.id, n.position]))
  for (const k of [1, 2]) {
    const tema = pos.get(`t${k}-n1`)!
    const bloque = pos.get(`t${k}-n2`)!
    const hoja = pos.get(`t${k}-n3`)!
    assert.ok(bloque.x > tema.x && hoja.x > bloque.x, JSON.stringify({ tema, bloque, hoja }))
  }
  assert.notDeepEqual(pos.get('t1-n2'), pos.get('t2-n2'))
})

test('treeToGraph: una rama plegada que queda a la izquierda de la raíz se abre hacia la izquierda', () => {
  const nodes: MapDoc['nodes'] = [{ id: 'r', parentId: null, text: 'Raíz', category: 'general' }]
  for (let k = 0; k < 10; k++) {
    nodes.push({ id: `b${k}`, parentId: 'r', text: `Bloque ${k}`, category: 'general', collapsed: true })
    nodes.push({ id: `h${k}`, parentId: `b${k}`, text: `Hoja ${k}`, category: 'general' })
  }
  const g = treeToGraph({ version: 1, nodes })
  const pos = new Map(g.nodes.map((n) => [n.id, n.position]))
  const raiz = pos.get('r')!
  let izquierda = 0
  for (let k = 0; k < 10; k++) {
    const b = pos.get(`b${k}`)!
    const h = pos.get(`h${k}`)!
    if (b.x < raiz.x) {
      izquierda += 1
      assert.ok(h.x < b.x, `hoja ${k} a la izquierda de su bloque`)
    } else assert.ok(h.x > b.x, `hoja ${k} a la derecha de su bloque`)
  }
  assert.ok(izquierda > 0) // con 10 bloques el mapa se abre en abanico
})

test('eventos de libro: temas, tema y ramas con su tema; los reinicios no mezclan temas', () => {
  assert.deepEqual(leerEvento('{"tipo":"temas","temas":[{"titulo":"T1","chars":5},{"x":1}]}'), {
    tipo: 'temas', temas: [{ titulo: 'T1', chars: 5 }, { titulo: '', chars: 0 }],
  })
  assert.deepEqual(leerEvento('{"tipo":"tema","i":2,"estado":"listo","nodos":40}'), { tipo: 'tema', i: 2, estado: 'listo', nodos: 40 })
  assert.equal(leerEvento('{"tipo":"tema","i":2,"estado":"raro"}'), null)
  let ls: LineaProvisional[] = []
  for (const l of [
    '{"tipo":"rama","tema":0,"parte":0,"d":1,"t":"Gota"}',
    '{"tipo":"rama","tema":1,"parte":0,"d":1,"t":"ACG"}',
    '{"tipo":"reinicio","tema":0,"parte":0}',
    '{"tipo":"rama","tema":0,"parte":0,"d":1,"t":"Gota bien"}',
  ]) ls = aplicarEvento(ls, leerEvento(l)!)
  const arbol = arbolLibro(ls, ['Tema 1', 'Tema 2'])
  assert.deepEqual(arbol.map((t) => [t.t, t.hijos.map((h) => h.t)]), [['Tema 1', ['Gota bien']], ['Tema 2', ['ACG']]])
})
