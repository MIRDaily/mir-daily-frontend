// Revisión guiada de los mapas de IA (informe 75): `ia` por nodo, saneado, conservación al
// guardar, exportar e importar, celdas dudosas y orden de N / Mayús+N.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDoubtfulCell, isPendingReview, origenLabel, sanitizeIA } from '@/lib/mapas/ia/revision'
import { sanitizeDoc } from '@/lib/mapas/tree'
import { sanitizeGraph, treeToGraph } from '@/lib/mapas/graph'
import { parseMapFile, serializeMap } from '@/lib/mapas/json'
import { nextPending, readingOrder } from '@/components/mapas/proto/utils/reviewOrder'
import type { MapTable } from '@/lib/mapas/table'

test('sanitizeIA: se queda solo con lo conocido y acota los valores', () => {
  assert.equal(sanitizeIA(null), undefined)
  assert.equal(sanitizeIA('x'), undefined)
  assert.equal(sanitizeIA({ otro: 1 }), undefined)
  assert.deepEqual(
    sanitizeIA({
      anclaje: 1.7,
      cerca: 0.456,
      pagina: 12,
      diapositiva: -3,
      seccion: '  Tema 2  ',
      dudoso: 'tratamiento',
      revisado: 'si',
      celdas: [{ f: 1, c: 2, t: 'x' }, { f: 'a', c: 1, t: 'y' }, null],
      html: '<img onerror=alert(1)>',
    }),
    { anclaje: 1, cerca: 0.46, pagina: 12, seccion: 'Tema 2', dudoso: 'tratamiento', celdas: [{ f: 1, c: 2, t: 'x' }] },
  )
  assert.equal(sanitizeIA({ dudoso: 'inventado' }), undefined)
  assert.deepEqual(sanitizeIA({ dudoso: 'anclaje', revisado: true }), { dudoso: 'anclaje', revisado: true })
})

test('pendiente = dudoso y no revisado; el origen se dice según la unidad', () => {
  assert.equal(isPendingReview(undefined), false)
  assert.equal(isPendingReview({ anclaje: 1 }), false)
  assert.equal(isPendingReview({ dudoso: 'anclaje' }), true)
  assert.equal(isPendingReview({ dudoso: 'anclaje', revisado: true }), false)
  assert.equal(origenLabel({ pagina: 4 }), 'Página 4')
  assert.equal(origenLabel({ diapositiva: 7 }), 'Diapositiva 7')
  assert.equal(origenLabel({ seccion: 'Gota' }), 'Sección «Gota»')
  assert.equal(origenLabel({ anclaje: 1 }), null)
})

const ARBOL = {
  version: 1,
  nodes: [
    { id: 'r', parentId: null, text: 'Vasculitis', category: 'general' },
    { id: 'a', parentId: 'r', text: 'Arteritis de células gigantes', category: 'general', ia: { anclaje: 1, pagina: 3 } },
    { id: 'b', parentId: 'a', text: 'Tratamiento: corticoides', category: 'tratamiento', ia: { anclaje: 1, cerca: 0.7, pagina: 4, dudoso: 'tratamiento' } },
    { id: 'c', parentId: 'a', text: 'Clínica: cefalea', category: 'clinica' },
  ],
}

test('el árbol de la IA conserva ia al convertirse en grafo, y los nodos sin ia siguen igual', () => {
  const tree = sanitizeDoc(ARBOL)
  assert.deepEqual(tree.nodes.find((n) => n.id === 'b')?.ia, { anclaje: 1, cerca: 0.7, pagina: 4, dudoso: 'tratamiento' })
  assert.equal(tree.nodes.find((n) => n.id === 'c')?.ia, undefined)
  const graph = treeToGraph(tree)
  assert.equal(graph.nodes.find((n) => n.id === 'b')?.data.ia?.dudoso, 'tratamiento')
  assert.equal('ia' in (graph.nodes.find((n) => n.id === 'c')?.data ?? {}), false)
})

test('sanitizeGraph, exportar e importar conservan ia (también revisado)', () => {
  const graph = treeToGraph(sanitizeDoc(ARBOL))
  const b = graph.nodes.find((n) => n.id === 'b')!
  b.data.ia = { ...b.data.ia, revisado: true }
  const again = sanitizeGraph(JSON.parse(JSON.stringify(graph)))
  assert.deepEqual(again.nodes.find((n) => n.id === 'b')?.data.ia, { anclaje: 1, cerca: 0.7, pagina: 4, dudoso: 'tratamiento', revisado: true })
  const { doc } = parseMapFile(serializeMap('Vasculitis', graph))
  const imported = (doc as typeof graph).nodes.find((n) => n.id === 'b')
  assert.equal(imported?.data.ia?.revisado, true)
  // Un ia hostil en un archivo importado se queda en nada.
  const hostil = sanitizeGraph({ version: 2, nodes: [{ id: 'x', data: { label: 'X', ia: { dudoso: '<script>' } } }], edges: [] })
  assert.equal(hostil.nodes[0].data.ia, undefined)
})

test('isDoubtfulCell: solo con la tabla pendiente y si la celda conserva el texto juzgado', () => {
  const table: MapTable = { title: 'T', columns: ['', 'A'], rows: [['Fila', 'dato raro']] } as MapTable
  const ia = { dudoso: 'celdas' as const, celdas: [{ f: 0, c: 1, t: 'dato raro' }] }
  assert.equal(isDoubtfulCell(ia, table, 0, 1), true)
  assert.equal(isDoubtfulCell(ia, table, 0, 0), false)
  assert.equal(isDoubtfulCell({ ...ia, revisado: true }, table, 0, 1), false)
  const corregida = { ...table, rows: [['Fila', 'dato bueno']] } as MapTable
  assert.equal(isDoubtfulCell(ia, corregida, 0, 1), false)
})

test('N / Mayús+N: orden de lectura (lado derecho y luego izquierdo, de arriba abajo) y vuelta al principio', () => {
  const at = (id: string, x: number, y: number, parentId?: string) => ({ id, position: { x, y }, data: { parentId } })
  const nodes = [
    at('root', 0, 0),
    at('izq', -300, -50, 'root'),
    at('der2', 300, 80, 'root'),
    at('der1', 300, -80, 'root'),
    at('der1b', 600, -40, 'der1'),
    at('der1a', 600, -120, 'der1'),
  ]
  const order = readingOrder(nodes, [])
  assert.deepEqual(order, ['root', 'der1', 'der1a', 'der1b', 'der2', 'izq'])
  const pending = new Set(['der1b', 'izq'])
  const isP = (id: string) => pending.has(id)
  assert.equal(nextPending(order, isP, null, 1), 'der1b')
  assert.equal(nextPending(order, isP, null, -1), 'izq')
  assert.equal(nextPending(order, isP, 'der1b', 1), 'izq')
  assert.equal(nextPending(order, isP, 'izq', 1), 'der1b') // da la vuelta
  assert.equal(nextPending(order, isP, 'der1b', -1), 'izq')
  assert.equal(nextPending(order, () => false, 'root', 1), null)
})

// ---------- modo estudio ----------

test('estudio: la faceta queda a la vista y solo se tapa el dato', async () => {
  const { splitFacet, splitFacetLabel, isCoverable } = await import('@/lib/mapas/study')
  assert.deepEqual(splitFacet('Clínica: cefalea temporal'), { faceta: 'Clínica', dato: 'cefalea temporal' })
  assert.deepEqual(splitFacet('Anatomía patológica: necrosis fibrinoide'), { faceta: 'Anatomía patológica', dato: 'necrosis fibrinoide' })
  assert.deepEqual(splitFacet('Cefalea temporal'), { faceta: '', dato: 'Cefalea temporal' })
  // Más de 4 palabras antes de los dos puntos: no es una faceta, se tapa todo.
  assert.equal(splitFacet('Clasificación de Chapel Hill 2012 revisada: grandes vasos').faceta, '')
  // Desde el label con formato del editor.
  assert.deepEqual(splitFacetLabel('<b>Tratamiento</b>: corticoides&nbsp;y <i>tocilizumab</i>'), {
    faceta: 'Tratamiento',
    dato: 'corticoides y tocilizumab',
  })
  // Solo se tapan las hojas que cuelgan de algo (la raíz y los sueltos sin hijos, no).
  assert.equal(isCoverable({ id: 'a', data: { parentId: 'r', childCount: 0 } }), true)
  assert.equal(isCoverable({ id: 'a', data: { parentId: 'r', childCount: 3 } }), false)
  assert.equal(isCoverable({ id: 'r', data: {} }), false)
})

// ---------- flashcards desde una rama ----------

test('flashcards: «Faceta: dato» → «Ruta del padre · Faceta» / «dato», sin la raíz del mapa', async () => {
  const { buildCards } = await import('@/lib/mapas/flashcards')
  let y = 0
  const n = (id: string, label: string, parentId?: string, extra = {}) => ({ id, label, parentId, y: y++, ...extra })
  const nodes = [
    n('r', 'Tema 03 Vasculitis'),
    n('g', 'Vasculitis de grandes vasos', 'r'),
    n('acg', 'Arteritis de <b>células gigantes</b>', 'g'),
    n('c1', 'Clínica: cefalea temporal, claudicación mandibular', 'acg'),
    n('c2', '<b>Tratamiento</b>: corticoides&nbsp;precoces', 'acg'),
    n('tak', 'Arteritis de Takayasu', 'g'),
    n('t1', 'Clínica: asimetría de pulsos', 'tak'),
    // Mapa hecho a mano: la faceta es un nodo y sus hojas no llevan prefijo.
    n('cl', 'Exploración', 'tak'),
    n('e1', 'Soplos', 'cl'),
    n('e2', 'Pulsos débiles', 'cl'),
    n('tab', '', 'tak', { table: { title: 'Criterios ACR/EULAR', columns: ['Criterio', 'Puntos'], rows: [['Sexo femenino', '+1'], ['Sin datos', '']] } }),
  ]
  const cards = buildCards(nodes, 'g')
  assert.deepEqual(
    cards.map((c) => [c.front, c.back, c.topic, c.kind]),
    [
      ['Vasculitis de grandes vasos › Arteritis de células gigantes · Clínica', 'cefalea temporal, claudicación mandibular', 'Arteritis de células gigantes', 'faceta'],
      ['Vasculitis de grandes vasos › Arteritis de células gigantes · Tratamiento', 'corticoides precoces', 'Arteritis de células gigantes', 'faceta'],
      ['Vasculitis de grandes vasos › Arteritis de Takayasu · Clínica', 'asimetría de pulsos', 'Arteritis de Takayasu', 'faceta'],
      ['Vasculitis de grandes vasos › Arteritis de Takayasu · Exploración', 'Soplos\nPulsos débiles', 'Arteritis de Takayasu', 'grupo'],
      ['Vasculitis de grandes vasos › Arteritis de Takayasu · Criterios ACR/EULAR · Sexo femenino', 'Puntos: +1', 'Arteritis de Takayasu', 'tabla'],
    ],
  )
  assert.ok(cards.every((c) => c.include))
  // Una hoja suelta seleccionada da su propia tarjeta; un nodo sin datos debajo, ninguna.
  assert.deepEqual(buildCards(nodes, 'c1').map((c) => c.back), ['cefalea temporal, claudicación mandibular'])
  assert.deepEqual(buildCards(nodes, 'e1'), [])
  assert.deepEqual(buildCards(nodes, 'nope'), [])
  // Una faceta colgada de la raíz lleva la raíz como ruta.
  assert.equal(buildCards([n('r2', 'Gota'), n('h', 'Definición: depósito de urato', 'r2')], 'r2')[0].front, 'Gota · Definición')

  // Con un subgrupo por medio, la ruta se queda con los dos últimos niveles.
  const sub = [...nodes, n('sg', 'Clínica y complicaciones', 'acg'), n('s1', 'Complicación: amaurosis', 'sg')]
  assert.equal(
    buildCards(sub, 'acg').find((c) => c.back === 'amaurosis')?.front,
    'Arteritis de células gigantes › Clínica y complicaciones · Complicación',
  )

  // Mapa hecho a mano con la enfermedad en la raíz: la ruta corta lleva la raíz, y la tarjeta del
  // nodo «Etiología» nombra también a su hijo con rama (que luego tiene la suya).
  const ic = [
    n('ic', 'Insuficiencia cardiaca'),
    n('et', 'Etiología', 'ic'),
    n('isq', 'Cardiopatía isquémica', 'et'),
    n('inf', 'Infarto previo', 'isq'),
    n('hta', 'HTA', 'et'),
  ]
  assert.deepEqual(
    buildCards(ic, 'ic').map((c) => [c.front, c.back]),
    [
      ['Insuficiencia cardiaca · Etiología', 'Cardiopatía isquémica\nHTA'],
      ['Insuficiencia cardiaca › Etiología · Cardiopatía isquémica', 'Infarto previo'],
    ],
  )
})
