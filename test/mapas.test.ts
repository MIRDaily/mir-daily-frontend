// Árbol del mapa mental: operaciones puras y layout.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeLayout } from '@/lib/mapas/layout'
import type { MapDoc } from '@/lib/mapas/types'
import { MapFileError, parseMapFile, serializeMap } from '@/lib/mapas/json'
import {
  addChild,
  addSibling,
  childrenOf,
  createDoc,
  getRoot,
  moveNode,
  removeSubtree,
  reorderSibling,
  sanitizeDoc,
  setCategory,
} from '@/lib/mapas/tree'

test('addChild hereda la categoría del padre y cuelga de él', () => {
  let doc = createDoc('Raíz')
  const root = getRoot(doc)
  doc = setCategory(doc, root.id, 'clinica')
  const a = addChild(doc, root.id)
  assert.equal(a.doc.nodes.find((n) => n.id === a.id)?.category, 'clinica')
  assert.equal(childrenOf(a.doc, root.id).length, 1)
})

test('addChild despliega al padre plegado', () => {
  const doc = createDoc()
  const r = getRoot(doc).id
  const folded = { ...doc, nodes: doc.nodes.map((n) => ({ ...n, collapsed: true })) }
  assert.equal(addChild(folded, r).doc.nodes[0].collapsed, false)
})

test('addSibling coloca el hermano tras el subárbol del nodo', () => {
  const doc = createDoc()
  const r = getRoot(doc).id
  const a = addChild(doc, r)
  const g = addChild(a.doc, a.id)
  const s = addSibling(g.doc, a.id)
  assert.deepEqual(
    s.doc.nodes.map((n) => n.id),
    [r, a.id, g.id, s.id],
  )
  assert.equal(s.doc.nodes.find((n) => n.id === s.id)?.parentId, r)
})

test('removeSubtree borra la rama y nunca la raíz', () => {
  const doc = createDoc()
  const r = getRoot(doc).id
  const a = addChild(doc, r)
  const g = addChild(a.doc, a.id)
  assert.equal(removeSubtree(g.doc, a.id).nodes.length, 1)
  assert.equal(removeSubtree(g.doc, r).nodes.length, 3)
})

test('moveNode no permite ciclos y reparenta con su rama', () => {
  const doc = createDoc()
  const r = getRoot(doc).id
  const a = addChild(doc, r)
  const g = addChild(a.doc, a.id)
  assert.equal(moveNode(g.doc, a.id, g.id), g.doc)
  const b = addChild(g.doc, r)
  const moved = moveNode(b.doc, a.id, b.id)
  assert.equal(moved.nodes.find((n) => n.id === a.id)?.parentId, b.id)
  assert.equal(moved.nodes.find((n) => n.id === g.id)?.parentId, a.id)
})

test('reorderSibling intercambia ramas enteras', () => {
  const doc = createDoc()
  const r = getRoot(doc).id
  const a = addChild(doc, r)
  const ag = addChild(a.doc, a.id)
  const b = addChild(ag.doc, r)
  const up = reorderSibling(b.doc, b.id, -1)
  assert.deepEqual(
    childrenOf(up, r).map((n) => n.id),
    [b.id, a.id],
  )
  assert.deepEqual(
    up.nodes.map((n) => n.id),
    [r, b.id, a.id, ag.id],
  )
  const down = reorderSibling(up, b.id, 1)
  assert.deepEqual(
    down.nodes.map((n) => n.id),
    [r, a.id, ag.id, b.id],
  )
})

test('sanitizeDoc repara huérfanos, ciclos, ids repetidos y categorías raras', () => {
  const doc = sanitizeDoc({
    nodes: [
      { id: 'r', parentId: null, text: 'R', category: 'clinica' },
      { id: 'x', parentId: 'nope', text: 'huérfano', category: 'zzz' },
      { id: 'c1', parentId: 'c2', text: 'ciclo' },
      { id: 'c2', parentId: 'c1', text: 'ciclo' },
      { id: 'r', parentId: null, text: 'duplicado' },
    ],
  })
  assert.equal(doc.nodes.length, 4)
  assert.equal(doc.nodes.filter((n) => n.parentId === null).length, 1)
  assert.equal(doc.nodes.find((n) => n.id === 'x')?.category, 'general')
  const ids = new Set(doc.nodes.map((n) => n.id))
  assert.ok(doc.nodes.every((n) => n.parentId === null || ids.has(n.parentId)))
  assert.equal(sanitizeDoc(null).nodes.length, 1)
})

test('computeLayout: hijos a la derecha, sin solaparse y padre centrado', () => {
  let doc = createDoc('Raíz')
  const r = getRoot(doc).id
  for (let i = 0; i < 3; i++) doc = addChild(doc, r).doc
  doc = addChild(doc, childrenOf(doc, r)[0].id).doc
  const box = computeLayout(doc)
  const kids = childrenOf(doc, r).map((k) => box.get(k.id)!)
  const root = box.get(r)!
  assert.ok(kids.every((k) => k.x > root.x + root.w))
  const sorted = kids.slice().sort((a, b) => a.y - b.y)
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].y >= sorted[i - 1].y + sorted[i - 1].h)
  const last = sorted[sorted.length - 1]
  assert.ok(Math.abs(root.y + root.h / 2 - (sorted[0].y + last.y + last.h) / 2) < 1)
})

test('computeLayout oculta los descendientes de un nodo plegado', () => {
  const doc = createDoc()
  const r = getRoot(doc).id
  const a = addChild(doc, r)
  const g = addChild(a.doc, a.id)
  const folded = { ...g.doc, nodes: g.doc.nodes.map((n) => (n.id === a.id ? { ...n, collapsed: true } : n)) }
  const box = computeLayout(folded)
  assert.ok(box.has(a.id))
  assert.ok(!box.has(g.id))
})

test('JSON: exportar e importar conserva el mapa', () => {
  let doc = createDoc('Raíz')
  const a = addChild(doc, getRoot(doc).id)
  doc = setCategory(a.doc, a.id, 'perla')
  const back = parseMapFile(serializeMap('Mi mapa', doc))
  assert.equal(back.title, 'Mi mapa')
  assert.deepEqual(back.doc, doc)
})

test('JSON: acepta un documento suelto y saca el título de la raíz', () => {
  const back = parseMapFile(JSON.stringify({ nodes: [{ id: 'r', parentId: null, text: 'Neumonía', category: 'clinica' }] }))
  assert.equal(back.title, 'Neumonía')
  assert.equal((back.doc as MapDoc).nodes[0].category, 'clinica')
})

test('JSON: rechaza basura, otros formatos y mapas vacíos', () => {
  assert.throws(() => parseMapFile('no es json'), MapFileError)
  assert.throws(() => parseMapFile('[1,2]'), MapFileError)
  assert.throws(() => parseMapFile(JSON.stringify({ format: 'otra-cosa', nodes: [] })), MapFileError)
  assert.throws(() => parseMapFile(JSON.stringify({ nodes: [] })), MapFileError)
})

test('JSON: sanea nodos rotos del archivo importado', () => {
  const back = parseMapFile(
    JSON.stringify({ nodes: [{ id: 'r', parentId: null, text: 'R' }, { id: 'x', parentId: 'no-existe', text: 'X', category: 'zzz' }] }),
  )
  const fixed = (back.doc as MapDoc).nodes.find((n) => n.id === 'x')
  assert.equal(fixed?.parentId, 'r')
  assert.equal(fixed?.category, 'general')
})

// ---- Formato grafo (el del prototipo) ------------------------------------

import {
  autoLayoutGraph,
  categoryAccent,
  naturalShape,
  newGraphDoc,
  sanitizeGraph,
  styleForCategory,
  toGraphDoc,
  treeToGraph,
} from '@/lib/mapas/graph'

function sampleTree() {
  let doc = createDoc('Neumonía')
  const r = getRoot(doc).id
  const a = addChild(doc, r)
  doc = setCategory(a.doc, a.id, 'clinica')
  const b = addChild(doc, a.id)
  const c = addChild(b.doc, r)
  return { doc: setCategory(c.doc, c.id, 'tratamiento'), r, a: a.id, b: b.id, c: c.id }
}

test('treeToGraph: un nodo y una arista por relación, con estilo por nivel', () => {
  const { doc, r, a, b } = sampleTree()
  const g = treeToGraph(doc)
  assert.equal(g.version, 2)
  assert.equal(g.nodes.length, 4)
  assert.equal(g.edges.length, 3)
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  assert.equal(byId.get(r)?.data.style.shape, 'circle')
  assert.equal(byId.get(a)?.data.style.shape, 'pill')
  assert.equal(byId.get(a)?.data.style.color, '#E8A598')
  assert.equal(byId.get(b)?.data.style.shape, 'rectangle')
  assert.equal(byId.get(b)?.data.parentId, a)
  assert.ok(g.edges.every((e) => e.type === 'animated' && e.sourceHandle === 'right' && e.targetHandle === 'left'))
})

test('treeToGraph: raíz con título largo es píldora, no círculo', () => {
  const g = treeToGraph(createDoc('Insuficiencia cardiaca crónica'))
  assert.equal(g.nodes[0].data.style.shape, 'pill')
})

test('toGraphDoc distingue árbol (posiciones provisionales) de grafo', () => {
  const { doc } = sampleTree()
  const fromTree = toGraphDoc(doc)
  assert.equal(fromTree.fromTree, true)
  const again = toGraphDoc(fromTree.doc)
  assert.equal(again.fromTree, false)
  assert.equal(again.doc.nodes.length, 4)
  assert.equal(toGraphDoc(null).doc.nodes.length, 1)
})

test('sanitizeGraph descarta aristas rotas, estilos raros y padres inexistentes', () => {
  const g = sanitizeGraph({
    version: 2,
    nodes: [
      { id: 'a', position: { x: 'no', y: 5 }, data: { label: 'A', style: { shape: 'triangulo', fontSize: 9999, color: 7 } } },
      { id: 'b', position: { x: 1, y: 2 }, data: { label: 'B', parentId: 'fantasma', category: 'perla' } },
      { id: 'a', data: { label: 'duplicado' } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', data: { variant: 'zigzag', strokeWidth: 500 } },
      { id: 'e2', source: 'a', target: 'nada' },
      { id: 'e3', source: 'b', target: 'b' },
    ],
    settings: { theme: 'neon', bgStyle: 'dots' },
  })
  assert.equal(g.nodes.length, 2)
  assert.equal(g.nodes[0].position.x, 0)
  assert.equal(g.nodes[0].data.style.shape, 'rectangle')
  assert.equal(g.nodes[0].data.style.fontSize, 72)
  assert.equal(g.nodes[0].data.style.color, '#FFFFFF')
  assert.equal(g.nodes[1].data.parentId, undefined)
  assert.equal(g.nodes[1].data.category, 'perla')
  assert.equal(g.edges.length, 1)
  assert.equal(g.edges[0].data.variant, undefined)
  assert.equal(g.edges[0].data.strokeWidth, 12)
  assert.deepEqual(g.settings, { bgStyle: 'dots' })
  assert.equal(sanitizeGraph({ nodes: [] }).nodes.length, 1)
})

test('autoLayoutGraph: ordena por jerarquía, apila árboles sueltos y respeta los tamaños reales', () => {
  const g = treeToGraph(sampleTree().doc)
  const extra = newGraphDoc('Suelto')
  extra.nodes[0].id = 'suelto'
  const nodes = [...g.nodes, ...extra.nodes]
  const sizes = new Map(nodes.map((n) => [n.id, { w: 200, h: 100 }]))
  const pos = autoLayoutGraph(nodes, g.edges, (id) => sizes.get(id))
  assert.equal(pos.size, 5)
  const root = g.nodes[0].id
  const kids = g.nodes.filter((n) => n.data.parentId === root).map((n) => pos.get(n.id)!)
  assert.ok(kids.every((k) => k.x >= pos.get(root)!.x + 200))
  const ys = kids.map((k) => k.y).sort((x, y) => x - y)
  assert.ok(ys[1] - ys[0] >= 100)
  // El árbol suelto queda por debajo de todo el otro.
  const bottom = Math.max(...g.nodes.map((n) => pos.get(n.id)!.y + 100))
  assert.ok(pos.get('suelto')!.y >= bottom)
})

test('autoLayoutGraph rompe ciclos de parentId sin colgarse', () => {
  const nodes = [
    { id: 'x', data: { label: 'X', parentId: 'y' } },
    { id: 'y', data: { label: 'Y', parentId: 'x' } },
  ]
  assert.equal(autoLayoutGraph(nodes, []).size, 2)
})

test('JSON: un grafo exportado se importa igual', () => {
  const g = treeToGraph(sampleTree().doc)
  const back = parseMapFile(serializeMap('Grafo', g))
  assert.equal(back.title, 'Grafo')
  assert.equal((back.doc as typeof g).version, 2)
  assert.equal(back.doc.nodes.length, 4)
  assert.equal((back.doc as typeof g).edges.length, 3)
})

test('estilos de categoría: el color y la forma del usuario mandan sobre los de serie', () => {
  const base = treeToGraph(sampleTree().doc).nodes.find((n) => n.data.style.shape === 'pill')!.data.style
  // Macizo (píldora de nivel 1): el color va al relleno y la forma se sustituye.
  const filled = styleForCategory(base, 'diagnostico', { diagnostico: { color: '#112233', shape: 'diamond' } })
  assert.equal(filled.color, '#112233')
  assert.equal(filled.shape, 'diamond')
  assert.equal(filled.glowColor, '#112233')
  assert.equal(filled.textColor, '#FFFFFF')
  // Sin forma fijada la del nodo se respeta; de contorno: el color va al borde.
  const outlined = { ...base, borderWidth: 2, color: '#FFFFFF', textColor: '#2A2420' }
  const kept = styleForCategory(outlined, 'clinica', { clinica: { color: '#445566' } })
  assert.equal(kept.shape, 'pill')
  assert.equal(kept.borderColor, '#445566')
  assert.equal(kept.color, '#FFFFFF')
  assert.equal(kept.fontSize, base.fontSize)
  assert.equal(categoryAccent('perla'), '#D4667A')
  assert.equal(categoryAccent('perla', { perla: { color: '#000000' } }), '#000000')
})

test('sanitizeGraph limpia los estilos de categoría del usuario', () => {
  const g = sanitizeGraph({
    nodes: [{ id: 'a', data: { label: 'A' } }],
    settings: {
      categoryStyles: {
        clinica: { color: '#abc123', shape: 'circle' },
        perla: { color: 'rojo', shape: 'triangulo' },
        inventada: { color: '#ffffff' },
        general: { shape: 'pill', color: '#12345' },
      },
    },
  })
  assert.deepEqual(g.settings?.categoryStyles, {
    clinica: { color: '#abc123', shape: 'circle' },
    general: { shape: 'pill' },
  })
})

test('naturalShape: la forma de serie depende del nivel y del largo del título', () => {
  assert.equal(naturalShape(0, 'Neumonía'), 'circle')
  assert.equal(naturalShape(0, 'Insuficiencia cardiaca crónica'), 'pill')
  assert.equal(naturalShape(1, 'Clínica'), 'pill')
  assert.equal(naturalShape(3, 'Disnea'), 'rectangle')
})

test('atajos 1–7: cada dígito es una categoría, en el orden del panel', async () => {
  const { categoryForKey, categoryNumber, MAP_CATEGORY_LIST } = await import('@/lib/mapas/types')
  assert.equal(categoryForKey('1'), 'general')
  assert.equal(categoryForKey('4'), 'clinica')
  assert.equal(categoryForKey('7'), 'perla')
  assert.equal(categoryForKey('8'), null)
  assert.equal(categoryForKey('0'), null)
  assert.equal(categoryForKey('a'), null)
  assert.equal(categoryForKey('12'), null)
  for (const c of MAP_CATEGORY_LIST) assert.equal(categoryForKey(String(categoryNumber(c.id))), c.id)
})
