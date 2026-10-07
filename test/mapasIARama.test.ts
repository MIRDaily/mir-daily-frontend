// Rehacer, ampliar o resumir una rama (informe 76): qué se manda (rama, camino, vecinos, páginas y
// fragmento) y cómo se mete la rama nueva en el mapa (posición, lado, estilos, revisión guiada).
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aplicarRama, fragmentoParaRama, paginasFragmento, ramaDeNodo, type NodoMapa, type LineaMapa } from '@/lib/mapas/ia/rama'
import { caducado, DIAS_DOCUMENTO } from '@/lib/mapas/ia/docs'
import { DEFAULT_GRAPH_STYLE } from '@/lib/mapas/graph'
import type { MapDoc } from '@/lib/mapas/types'

const nodo = (id: string, label: string, parentId: string | undefined, x: number, y: number, extra: Partial<NodoMapa['data']> = {}): NodoMapa => ({
  id,
  position: { x, y },
  measured: { width: 160, height: 44 },
  data: { label, ...(parentId ? { parentId } : {}), style: { ...DEFAULT_GRAPH_STYLE }, category: 'general', ...extra },
})

// Raíz en el centro; «Grandes vasos» a la derecha con ACG y Takayasu; «Pequeño vaso» a la izquierda.
const NODOS: NodoMapa[] = [
  nodo('r', 'Vasculitis', undefined, 0, 0),
  nodo('g', 'Grandes vasos', 'r', 300, 0),
  nodo('acg', 'Arteritis de <b>células</b> gigantes', 'g', 600, -100),
  nodo('acg1', 'Clínica: cefalea', 'acg', 900, -120, { ia: { pagina: 10, revisado: true, dudoso: 'anclaje' } }),
  nodo('acg2', 'Tratamiento: corticoides', 'acg', 900, -80, { ia: { pagina: 11 } }),
  nodo('acg3', 'Definición: granulomatosa', 'acg', 900, -150, { ia: { pagina: 30 } }),
  nodo('tak', 'Arteritis de Takayasu', 'g', 600, 100),
  nodo('tak1', 'Clínica: sin pulsos', 'tak', 900, 100),
  nodo('p', 'Pequeño vaso', 'r', -300, 0),
  nodo('pan', 'PAN', 'p', -600, 0),
]
const LINEAS: LineaMapa[] = NODOS.filter((n) => n.data.parentId).map((n) => ({ id: `e-${n.data.parentId}-${n.id}`, source: n.data.parentId!, target: n.id }))

test('ramaDeNodo: líneas en orden de lectura, camino, vecinos y páginas', () => {
  const r = ramaDeNodo(NODOS, 'acg')!
  assert.deepEqual(r.rama, [
    { d: 0, t: 'Arteritis de células gigantes' },
    { d: 1, t: 'Definición: granulomatosa' },
    { d: 1, t: 'Clínica: cefalea' },
    { d: 1, t: 'Tratamiento: corticoides' },
  ])
  assert.deepEqual(r.ruta, ['Vasculitis', 'Grandes vasos'])
  assert.deepEqual(r.vecinos, ['Arteritis de Takayasu'])
  assert.deepEqual(r.paginas.sort((a, b) => a - b), [10, 11, 30])
  assert.equal(ramaDeNodo(NODOS, 'nada'), null)
})

test('paginasFragmento: alrededor de la mediana, sin las páginas lejanas', () => {
  assert.deepEqual(paginasFragmento([10, 11, 30]), { desde: 9, hasta: 12 })
  assert.equal(paginasFragmento([]), null)
})

test('fragmentoParaRama: por páginas; sin páginas, las secciones que más comparten con la rama', () => {
  const secs = Array.from({ length: 40 }, (_, i) => ({ texto: `Página ${i + 1}. ${'relleno '.repeat(400)}`, pagina: i + 1 }))
  assert.deepEqual(fragmentoParaRama(secs, [10, 11, 30], 'x').map((s) => s.pagina), [9, 10, 11, 12])
  const word = Array.from({ length: 30 }, (_, i) => ({
    titulo: `Apartado ${i}`,
    texto: (i === 20 ? 'arteritis temporal cefalea claudicación mandibular ' : 'otra cosa distinta ') + 'x'.repeat(3000),
  }))
  const f = fragmentoParaRama(word, [], 'Arteritis temporal: cefalea y claudicación mandibular')
  assert.ok(f.some((s) => s.titulo === 'Apartado 20'))
  assert.ok(f.reduce((n, s) => n + s.texto.length, 0) <= 55000)
  // Un documento pequeño va entero.
  assert.equal(fragmentoParaRama(word.slice(0, 3), [], 'x').length, 3)
})

const NUEVA: MapDoc = {
  version: 1,
  nodes: [
    { id: 'n1', parentId: null, text: 'Arteritis de células gigantes', category: 'general' },
    { id: 'n2', parentId: 'n1', text: 'Clínica y diagnóstico', category: 'general', ia: { subgrupo: true } },
    { id: 'n3', parentId: 'n2', text: 'Clínica: cefalea', category: 'clinica', ia: { anclaje: 1, pagina: 10, dudoso: 'anclaje' } },
    { id: 'n4', parentId: 'n2', text: 'Diagnóstico: <img src=x onerror=alert(1)>biopsia', category: 'diagnostico', ia: { pagina: 11 } },
    { id: 'n5', parentId: 'n1', text: 'Tratamiento: prednisona', category: 'tratamiento' },
  ],
}

test('aplicarRama: sustituye los descendientes, conserva la raíz y abre hacia fuera', () => {
  let k = 0
  const r = aplicarRama(NODOS, LINEAS, 'acg', NUEVA, { nuevoId: () => `x${++k}` })!
  const ids = new Set(r.nodes.map((n) => n.id))
  for (const viejo of ['acg1', 'acg2', 'acg3']) assert.ok(!ids.has(viejo))
  assert.ok(ids.has('acg') && ids.has('tak1'))
  assert.equal(r.nuevos.length, 4)
  const raiz = r.nodes.find((n) => n.id === 'acg')!
  assert.deepEqual(raiz.position, { x: 600, y: -100 })
  for (const id of r.nuevos) assert.ok(r.nodes.find((n) => n.id === id)!.position.x > 600 + 160)
  // Líneas: las viejas fuera, una por nodo nuevo desde su padre.
  assert.ok(!r.edges.some((e) => e.target === 'acg1'))
  assert.equal(r.edges.filter((e) => r.nuevos.includes(e.target)).length, 4)
  // Texto saneado, estilo por nivel (el subgrupo como rótulo) y revisión guiada.
  const diag = r.nodes.find((n) => n.data.label.includes('biopsia'))!
  assert.ok(!/onerror|<img/.test(diag.data.label))
  const sub = r.nodes.find((n) => n.data.label === 'Clínica y diagnóstico')!
  assert.equal(sub.data.style.shape, 'label')
  const cef = r.nodes.find((n) => n.data.label === 'Clínica: cefalea')!
  assert.equal(cef.data.parentId, sub.id)
  assert.equal(cef.data.ia?.revisado, true) // tenía el mismo texto y estaba revisado
  assert.equal(cef.data.ia?.pagina, 10)
})

test('aplicarRama: una rama a la izquierda de su padre se abre hacia la izquierda; una plegada se despliega', () => {
  const nodos = NODOS.map((n) => (n.id === 'pan' ? { ...n, data: { ...n.data, collapsed: true } } : n))
  let k = 0
  const r = aplicarRama(nodos, LINEAS, 'pan', NUEVA, { nuevoId: () => `y${++k}` })!
  for (const id of r.nuevos) assert.ok(r.nodes.find((n) => n.id === id)!.position.x < -600)
  assert.equal(r.nodes.find((n) => n.id === 'pan')!.data.collapsed, false)
})

test('aplicarRama con marcarNuevos: los nodos añadidos quedan pendientes de revisar', () => {
  let k = 0
  const r = aplicarRama(NODOS, LINEAS, 'tak', NUEVA, { nuevoId: () => `z${++k}`, marcarNuevos: true })!
  for (const id of r.nuevos) {
    const ia = r.nodes.find((n) => n.id === id)!.data.ia
    assert.ok(ia?.dudoso, id)
  }
})

test('caducado: a los 30 días, o si el registro está roto', () => {
  const ahora = Date.now()
  assert.equal(caducado({ caduca: ahora + 1000 }, ahora), false)
  assert.equal(caducado({ caduca: ahora - 1 }, ahora), true)
  assert.equal(caducado(null, ahora), true)
  assert.equal(DIAS_DOCUMENTO, 30)
})

test('fuente del mapa: del árbol de la IA a los ajustes del grafo; saneada (solo hash válido, nombre corto)', async () => {
  const { toGraphDoc, sanitizeGraph } = await import('@/lib/mapas/graph')
  const hash = 'a'.repeat(64)
  const arbol = { version: 1, nodes: [{ id: 'n1', parentId: null, text: 'T', category: 'general' }], fuente: { hash, nombre: 'Tema.pdf', modo: 'detalle' } }
  const { doc } = toGraphDoc(arbol)
  assert.deepEqual(doc.settings?.fuente, { hash, nombre: 'Tema.pdf', modo: 'detalle' })
  assert.deepEqual(sanitizeGraph(doc).settings?.fuente, { hash, nombre: 'Tema.pdf', modo: 'detalle' })
  const malo = sanitizeGraph({ ...doc, settings: { fuente: { hash: 'zz', nombre: 'x' } } })
  assert.equal(malo.settings?.fuente, undefined)
  const largo = sanitizeGraph({ ...doc, settings: { fuente: { hash, nombre: 'n'.repeat(500), modo: 'raro' } } })
  assert.equal(largo.settings?.fuente?.nombre.length, 160)
  assert.equal(largo.settings?.fuente?.modo, undefined)
})
