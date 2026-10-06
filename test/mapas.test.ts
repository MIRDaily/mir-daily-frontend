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
  categoryLabel,
  sanitizeCategoryStyles,
  styleForNode,
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

test('sanitizeGraph conserva solo collapsed === true', () => {
  const g = sanitizeGraph({
    version: 2,
    nodes: [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A', collapsed: true } },
      { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B', collapsed: 'sí' } },
    ],
    edges: [],
  })
  assert.equal(g.nodes[0].data.collapsed, true)
  assert.equal('collapsed' in g.nodes[1].data, false)
})

// ---------------------------------------------------------------------------
// Ramas del editor: plegar y descendientes
// ---------------------------------------------------------------------------

import { childrenMap, descendantsOf, parentMap, syncCollapse } from '@/components/mapas/proto/utils/tree'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

function engineNode(id: string, x: number, parentId?: string, collapsed?: boolean): MindMapNode {
  return {
    id,
    type: 'mindmap',
    position: { x, y: 0 },
    data: {
      label: id,
      style: {} as MindMapNode['data']['style'],
      isEditing: false,
      isFocused: false,
      isNew: false,
      isRemoving: false,
      ...(parentId ? { parentId } : {}),
      ...(collapsed ? { collapsed } : {}),
    },
  }
}
const engineEdge = (s: string, t: string): MindMapEdge => ({ id: `${s}-${t}`, source: s, target: t, type: 'animated' })

test('parentMap usa parentId y, si falta, la primera arista entrante', () => {
  const nodes = [engineNode('r', 0), engineNode('a', 200, 'r'), engineNode('b', 200)]
  const edges = [engineEdge('r', 'a'), engineEdge('a', 'b')]
  const p = parentMap(nodes, edges)
  assert.equal(p.get('a'), 'r')
  assert.equal(p.get('b'), 'a')
  assert.equal(p.has('r'), false)
})

test('descendantsOf no se cuelga con ciclos', () => {
  const children = new Map([['a', ['b']], ['b', ['a', 'c']]])
  assert.deepEqual([...descendantsOf(['a'], children)].sort(), ['b', 'c'])
  assert.deepEqual([...descendantsOf(['x'], childrenMap(new Map()))], [])
})

test('syncCollapse oculta la rama plegada, sus líneas y cuenta lo oculto', () => {
  const nodes = [
    engineNode('r', 0),
    engineNode('a', 300, 'r', true),
    engineNode('a1', 600, 'a'),
    engineNode('a2', 600, 'a'),
    engineNode('a11', 900, 'a1'),
    engineNode('izq', -400, 'r'),
  ]
  const edges = [engineEdge('r', 'a'), engineEdge('a', 'a1'), engineEdge('a', 'a2'), engineEdge('a1', 'a11'), engineEdge('r', 'izq')]
  syncCollapse(nodes, edges)
  const by = new Map(nodes.map((n) => [n.id, n]))
  assert.deepEqual(nodes.filter((n) => n.hidden).map((n) => n.id).sort(), ['a1', 'a11', 'a2'])
  assert.equal(!!by.get('a')!.hidden, false)
  assert.equal(by.get('a')!.data.hiddenCount, 3)
  assert.equal(by.get('a')!.data.childCount, 2)
  assert.equal(by.get('a')!.data.childSide, 'right')
  assert.equal(edges.filter((e) => e.hidden).length, 3)
  // Desplegar lo vuelve a mostrar todo.
  by.get('a')!.data.collapsed = false
  syncCollapse(nodes, edges)
  assert.equal(nodes.some((n) => n.hidden), false)
  assert.equal(by.get('a')!.data.hiddenCount, 0)
})

// ---------------------------------------------------------------------------
// Tutorial interactivo
// ---------------------------------------------------------------------------

import { LESSONS } from '@/components/mapas/tutorial/lessons'
import { LESSON_IDS, TOTAL_LESSONS } from '@/components/mapas/tutorial/progress'
import { PRACTICE_IDS, PRACTICE_MAP } from '@/lib/mapas/tutorial/practiceMap'

test('el tutorial: total de lecciones al día, ids únicos y mapa de práctica válido', () => {
  assert.equal(TOTAL_LESSONS, LESSONS.length)
  assert.deepEqual([...LESSON_IDS], LESSONS.map((l) => l.id))
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length)
  for (const l of LESSONS) {
    assert.ok(l.intro.length > 0, `${l.id} sin introducción`)
    assert.equal(new Set(l.tasks.map((t) => t.id)).size, l.tasks.length, `${l.id}: tareas repetidas`)
  }
  // Las demostraciones señalan nodos por id: tienen que existir en el mapa de práctica.
  const ids = new Set(PRACTICE_MAP.nodes.map((n) => n.id))
  for (const id of [...Object.values(PRACTICE_IDS), 'eti-2', 'cli-1']) assert.ok(ids.has(id), `falta ${id}`)
  assert.equal(sanitizeDoc(PRACTICE_MAP).nodes.length, PRACTICE_MAP.nodes.length)
})

// ---------------------------------------------------------------------------
// Categorías editables por completo
// ---------------------------------------------------------------------------

test('categorías: se sanean todos los ajustes y se descarta lo inválido', () => {
  const out = sanitizeCategoryStyles({
    clinica: {
      label: '  Cuadro clínico  ',
      fill: '#112233',
      border: 'rojo',
      borderWidth: 99,
      textColor: '#FFF',
      fontFamily: 'Caveat',
      fontSize: 3,
      shape: 'diamond',
    },
    inventada: { color: '#000000' },
    perla: { color: 'no' },
  })
  assert.deepEqual(out.clinica, {
    label: 'Cuadro clínico',
    fill: '#112233',
    borderWidth: 8,
    textColor: '#FFF',
    fontFamily: 'Caveat',
    fontSize: 8,
    shape: 'diamond',
  })
  assert.equal(out.perla, undefined)
  assert.equal(categoryLabel('clinica', out), 'Cuadro clínico')
  assert.equal(categoryLabel('perla', out), 'Perla MIR')
})

test('categorías: relleno, borde y fuente se aplican y, al quitarlos, vuelven a lo natural', () => {
  const natural = styleForNode(2, 'clinica', 'Disnea')
  const prev = { fill: '#112233', border: '#445566', borderWidth: 4, fontFamily: 'Caveat', fontSize: 20 }
  const styled = styleForCategory(natural, 'clinica', { clinica: prev })
  assert.equal(styled.color, '#112233')
  assert.equal(styled.borderColor, '#445566')
  assert.equal(styled.borderWidth, 4)
  assert.equal(styled.fontFamily, 'Caveat')
  assert.equal(styled.fontSize, 20)
  // Se quita todo: cada campo vuelve al del estilo natural del nodo.
  const back = styleForCategory(styled, 'clinica', {}, { prev, natural })
  assert.equal(back.color, natural.color)
  assert.equal(back.borderWidth, natural.borderWidth)
  assert.equal(back.fontFamily, natural.fontFamily)
  assert.equal(back.fontSize, natural.fontSize)
})

// ---------------------------------------------------------------------------
// Exportación (PDF vectorial / PNG): texto, rutas y reparto en hojas
// ---------------------------------------------------------------------------

import { parseLabel, plainText } from '@/lib/mapas/export/richtext'
import { wrapParagraphs } from '@/lib/mapas/export/layout'
import { parsePath, type Section, type SceneNode } from '@/lib/mapas/export/scene'
import { planPages } from '@/lib/mapas/export/pages'
import { parseColor } from '@/lib/mapas/export/color'
import { applyInk } from '@/lib/mapas/export/print'

test('export: el texto con formato se separa en tramos y párrafos', () => {
  const p = parseLabel('Hola <b>mundo <i>feliz</i></b><br>segunda &amp; línea<div>tercera</div>')
  assert.equal(p.length, 3)
  assert.deepEqual(p[0].map((r) => [r.text, !!r.bold, !!r.italic]), [['Hola ', false, false], ['mundo ', true, false], ['feliz', true, true]])
  assert.equal(p[1][0].text, 'segunda & línea')
  assert.equal(plainText('<b>a</b> <i>b</i>'), 'a b')
})

test('export: el texto se parte por palabras según el ancho', () => {
  const measure = (t: string) => t.length * 10
  const lines = wrapParagraphs(parseLabel('uno dos tres cuatro'), 90, { family: 'Lexend', size: 10 }, measure)
  assert.deepEqual(lines.map((l) => l.runs.map((r) => r.text).join('')), ['uno dos', 'tres', 'cuatro'])
  // Una palabra más larga que la línea se parte por letras en vez de salirse.
  const long = wrapParagraphs(parseLabel('abcdefghijkl'), 50, { family: 'Lexend', size: 10 }, measure)
  assert.ok(long.length >= 2 && long.every((l) => l.width <= 50))
})

test('export: la ruta SVG se lee en absoluto (M, L, C, Q y relativos)', () => {
  assert.deepEqual(parsePath('M 183 270 C 263.5 270, 212.5 22, 293 22'), [['M', 183, 270], ['C', 263.5, 270, 212.5, 22, 293, 22]])
  assert.deepEqual(parsePath('M10 10 l5 5 h5 v-5'), [['M', 10, 10], ['L', 15, 15], ['L', 20, 15], ['L', 20, 10]])
  assert.deepEqual(parseColor('rgb(110, 155, 197)'), { r: 110, g: 155, b: 197, a: 1 })
  assert.equal(parseColor('#FFF').g, 255)
})

function boxNode(id: string, x: number, y: number): SceneNode {
  return { id, parentId: null, x, y, w: 160, h: 50, shape: 'rectangle', fill: '#fff', stroke: '#000', strokeWidth: 1, textColor: '#000', fontFamily: 'Lexend', fontSize: 14, align: 'center', paragraphs: [[{ text: id }]] }
}

test('export: reparto en hojas (una hoja, mosaico a tamaño real y una por parte)', () => {
  const small: Section = { title: '', nodes: [boxNode('a', 0, 0), boxNode('b', 300, 200)], edges: [] }
  // Un mapa grande y denso: una fila de nodos cada 150 px en diagonal.
  const big: Section = { title: '', nodes: Array.from({ length: 21 }, (_, i) => boxNode('n' + i, i * 150, i * 100)), edges: [] }
  const base = { paper: 'a4' as const, orientation: 'auto' as const, withTitle: true }
  const one = planPages([small], { ...base, distribution: 'fit' })
  assert.equal(one.length, 1)
  assert.ok(one[0].scale <= 1.4 + 1e-9)
  const tiles = planPages([big], { ...base, distribution: 'tiles' })
  assert.ok(tiles.length > 4)
  assert.ok(tiles.every((p) => p.scale === 0.75 && p.tile))
  // Las hojas contiguas se solapan (para poder pegarlas) y cubren todo el mapa.
  const xs = tiles.filter((p) => p.tile!.row === 0).map((p) => p.region.x)
  const reach = tiles.filter((p) => p.tile!.row === 0).at(-1)!.region
  assert.ok(xs[1] < xs[0] + tiles[0].region.w)
  void reach
  assert.ok(Math.max(...tiles.map((p) => p.region.x + p.region.w)) >= 3000 + 160 - 1)
  const parts = planPages([small, { ...small, title: 'Rama' }], { ...base, distribution: 'fit' })
  assert.equal(parts.length, 2)
})

// ---------------------------------------------------------------------------
// Lista de mapas: miniatura y texto buscable
// ---------------------------------------------------------------------------

import { searchable, summarizeDoc } from '@/lib/mapas/summary'

test('lista: la miniatura y el texto salen del propio documento', () => {
  const s = summarizeDoc(PRACTICE_MAP)
  assert.ok(s.thumb && s.thumb.nodes.length === PRACTICE_MAP.nodes.length)
  assert.equal(s.thumb!.edges.length, PRACTICE_MAP.nodes.length - 1)
  assert.ok(s.text.includes('insuficiencia cardiaca') && s.text.includes('peptidos natriureticos'))
  assert.ok(summarizeDoc({ nope: true }).thumb!.nodes.length >= 1) // un documento ilegible se repara, no rompe la lista
  assert.equal(searchable('<b>Diagnóstico</b>&nbsp;ÓPTICO'), 'diagnostico optico')
})

test('export: ahorro de tinta quita los rellenos y deja contornos legibles', () => {
  const solid: SceneNode = { ...boxNode('a', 0, 0), fill: '#9B86BD', stroke: '#9B86BD', strokeWidth: 0, textColor: '#FFFFFF' }
  const outlined: SceneNode = { ...boxNode('b', 0, 0), fill: '#FFFFFF', stroke: '#E8A598', strokeWidth: 2, textColor: '#2A2420' }
  const section: Section = {
    title: '',
    nodes: [solid, outlined],
    edges: [{ id: 'e', source: 'a', target: 'b', cmds: [], color: '#F0F0F0', width: 1.8, dash: null }],
  }
  const save = applyInk(section, 'save')
  assert.equal(save.nodes[0].fill, '#FFFFFF')
  assert.equal(save.nodes[0].stroke, '#9B86BD')
  assert.ok(save.nodes[0].strokeWidth >= 1.6)
  assert.equal(save.nodes[0].textColor, '#2A2420') // la letra blanca sobre blanco no se leería
  assert.equal(save.nodes[1].stroke, '#E8A598')
  assert.equal(save.edges[0].color, '#7D8A96') // una línea casi blanca se oscurece
  const bw = applyInk(section, 'gray')
  assert.ok(/^#([0-9a-f]{2})\1\1$/.test(bw.nodes[0].stroke) && /^#([0-9a-f]{2})\1\1$/.test(bw.nodes[0].textColor))
  assert.equal(applyInk(section, 'color'), section)
})

// ---- Margen entre bloques y mapa en abanico (IA de mapas) ----

function mapaDeBloques(n: number): { doc: MapDoc; raiz: string } {
  let doc = createDoc('Tema')
  const raiz = getRoot(doc).id
  for (let i = 0; i < n; i++) {
    const b = addChild(doc, raiz)
    doc = b.doc
    doc = addChild(doc, b.id).doc
    doc = addChild(doc, b.id).doc
  }
  return { doc, raiz }
}

test('computeLayout: depthGaps separa más los hijos de la raíz que los del resto', () => {
  const { doc, raiz } = mapaDeBloques(4)
  const plano = computeLayout(doc)
  const aireado = computeLayout(doc, { depthGaps: [60, 22] })
  const huecoEntre = (box: Map<string, { y: number; h: number }>, ids: string[]) => {
    const s = ids.map((id) => box.get(id)!).sort((a, b) => a.y - b.y)
    return s[1].y - (s[0].y + s[0].h)
  }
  const bloques = childrenOf(doc, raiz).map((b) => b.id)
  assert.ok(huecoEntre(aireado, bloques) > huecoEntre(plano, bloques) + 40)
  // Los nietos (hijos de un bloque) también ganan algo, pero menos que los bloques.
  const nietos = childrenOf(doc, bloques[0]).map((b) => b.id)
  const extraNietos = huecoEntre(aireado, nietos) - huecoEntre(plano, nietos)
  assert.ok(extraNietos > 0 && extraNietos < 40)
})

test('computeLayout: twoSidedFrom abre el mapa a ambos lados, equilibrado y sin solapes', () => {
  const { doc, raiz } = mapaDeBloques(10)
  const caja = computeLayout(doc, { depthGaps: [60, 22], twoSidedFrom: 8 })
  const r = caja.get(raiz)!
  const bloques = childrenOf(doc, raiz).map((b) => caja.get(b.id)!)
  const derecha = bloques.filter((b) => b.x >= r.x + r.w)
  const izquierda = bloques.filter((b) => b.x + b.w <= r.x)
  assert.equal(derecha.length + izquierda.length, 10)
  assert.ok(derecha.length >= 3 && izquierda.length >= 3)
  // Orden de lectura: los primeros bloques a la derecha, el resto a la izquierda.
  const ids = childrenOf(doc, raiz).map((b) => b.id)
  assert.ok(ids.slice(0, derecha.length).every((id) => caja.get(id)!.x >= r.x + r.w))
  // Ninguna caja se pisa con otra.
  const todas = [...caja.values()]
  for (let i = 0; i < todas.length; i++) {
    for (let j = i + 1; j < todas.length; j++) {
      const a = todas[i]
      const b = todas[j]
      const solapa = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      assert.ok(!solapa, `solape entre ${i} y ${j}`)
    }
  }
  // Los hijos de un bloque de la izquierda quedan aún más a la izquierda.
  const bi = childrenOf(doc, raiz).find((b) => caja.get(b.id)!.x + caja.get(b.id)!.w <= r.x)!
  const hijoDeIzquierda = caja.get(childrenOf(doc, bi.id)[0].id)!
  assert.ok(hijoDeIzquierda.x + hijoDeIzquierda.w <= caja.get(bi.id)!.x)
})

test('computeLayout: con pocos bloques, o sin la opción, todo sigue a la derecha', () => {
  const pocos = mapaDeBloques(5)
  const a = computeLayout(pocos.doc, { twoSidedFrom: 8 })
  const r = a.get(pocos.raiz)!
  assert.ok(childrenOf(pocos.doc, pocos.raiz).every((b) => a.get(b.id)!.x >= r.x + r.w))
  const muchos = mapaDeBloques(12)
  const b = computeLayout(muchos.doc)
  const rb = b.get(muchos.raiz)!
  assert.ok(childrenOf(muchos.doc, muchos.raiz).every((k) => b.get(k.id)!.x >= rb.x + rb.w))
})

// ---------------------------------------------------------------------------
// Saneado del HTML de los nodos (XSS al importar o abrir un mapa ajeno)
// ---------------------------------------------------------------------------

import { sanitizeLabelHtml } from '@/lib/mapas/labelHtml'

test('sanitizeLabelHtml: lo que deja el editor sale igual', () => {
  const tal = [
    'Neumonía',
    '<b>Negrita</b> y <i>cursiva</i>',
    '<u>sub</u><strike>tachado</strike><s>s</s><strong>f</strong><em>e</em>',
    'Línea 1<br>Línea 2',
    '<div>Uno</div><div><br></div><div>Dos</div>',
    'a&nbsp;b &amp; c &lt;d&gt;',
    '<span style="font-weight: normal">x</span>',
    '<b><i>anidado</i></b>',
  ]
  for (const html of tal) assert.equal(sanitizeLabelHtml(html), html)
  assert.equal(sanitizeLabelHtml(''), '')
})

test('sanitizeLabelHtml: fuera eventos, scripts, URLs y etiquetas peligrosas', () => {
  const ataques = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<svg onload=alert(1)><circle/></svg>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">pulsa</a>',
    '<b onclick="alert(1)">x</b>',
    '<b/onmouseover=alert(1)>x</b>',
    '<div style="background-image: url(javascript:alert(1))">x</div>',
    '<span style="width: expression(alert(1))">x</span>',
    '<span style="color: red; background: url(//evil)">x</span>',
    '<span style="position: fixed; top: 0">x</span>',
    '<<script>alert(1)//<</script>',
    '<!--<img src=x onerror=alert(1)>-->',
    '<b title="<img src=x onerror=alert(1)>">x</b>',
    '<style>*{background:url(//evil)}</style>',
    '<object data="x"></object><embed src="x"><form action="x"><input onfocus=alert(1) autofocus>',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<b style="color: &quot;red&quot;; behavior: url(x.htc)">x</b>',
  ]
  for (const html of ataques) {
    const out = sanitizeLabelHtml(html)
    assert.doesNotMatch(out, /<(?!\/?(b|i|u|s|em|strong|strike|del|span|sub|sup|div|p|br)[ >])/i, out)
    assert.doesNotMatch(out, /\son\w+\s*=|javascript:|url\(|expression|position/i, out)
    assert.equal(sanitizeLabelHtml(out), out, 'idempotente')
  }
  // Se queda el texto visible; el contenido de <script>/<style> no.
  assert.equal(sanitizeLabelHtml('<a href="javascript:x">pulsa</a>'), 'pulsa')
  assert.equal(sanitizeLabelHtml('a<script>alert(1)</script>b'), 'ab')
  assert.equal(sanitizeLabelHtml('<b onclick="alert(1)">x</b>'), '<b>x</b>')
  assert.equal(sanitizeLabelHtml('<span style="color: red; background: url(//evil)">x</span>'), '<span style="color: red">x</span>')
})

test('sanitizeLabelHtml: escapa el texto suelto y cierra lo que queda abierto', () => {
  assert.equal(sanitizeLabelHtml('FEVI < 40% y > 2'), 'FEVI &lt; 40% y &gt; 2')
  assert.equal(sanitizeLabelHtml('<b>sin cerrar'), '<b>sin cerrar</b>')
  assert.equal(sanitizeLabelHtml('x</b></div>'), 'x')
  assert.equal(sanitizeLabelHtml('<b><i>x</b>y'), '<b><i>x</i></b>y')
  assert.equal(sanitizeLabelHtml('R&D'), 'R&amp;D')
  // Lo pegado de otras webs: bloques a <div>, estilos de texto razonables, comillas a simples.
  assert.equal(sanitizeLabelHtml('<ul><li>a</li><li>b</li></ul>'), '<div>a</div><div>b</div>')
  assert.equal(
    sanitizeLabelHtml('<span style="font-family: &quot;Times New Roman&quot;; color: rgb(10, 20, 30);">t</span>'),
    `<span style="font-family: 'Times New Roman'; color: rgb(10, 20, 30)">t</span>`,
  )
})

test('sanitizeGraph, treeToGraph y la importación sanean los labels', () => {
  const evil = '<img src=x onerror=alert(1)><b>Hola</b>'
  const g = sanitizeGraph({
    version: 2,
    nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: evil } }],
    edges: [],
  })
  assert.equal(g.nodes[0].data.label, '<b>Hola</b>')

  const t = treeToGraph({ version: 1, nodes: [{ id: 'r', parentId: null, text: evil, category: 'general' }] })
  assert.equal(t.nodes[0].data.label, '<b>Hola</b>')

  const file = serializeMap('x', {
    version: 2,
    nodes: [{ id: 'a', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: evil, style: newGraphDoc().nodes[0].data.style } }],
    edges: [],
  })
  const imported = parseMapFile(file).doc as { nodes: { data: { label: string } }[] }
  assert.equal(imported.nodes[0].data.label, '<b>Hola</b>')
  // Al abrir un árbol importado (o guardado) también.
  const tree = parseMapFile(JSON.stringify({ nodes: [{ id: 'r', parentId: null, text: evil }] })).doc
  assert.equal(toGraphDoc(tree).doc.nodes[0].data.label, '<b>Hola</b>')
})

// ---- Nodo tabla -----------------------------------------------------------

import {
  cleanCell,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  removeColumn,
  removeRow,
  sanitizeTable,
  setCell,
  tableGeometry,
  tableToLabel,
  TABLE_GEOMETRY,
  TABLE_LIMITS,
  type MapTable,
} from '@/lib/mapas/table'
import { estimateTableSize } from '@/lib/mapas/layout'

const TABLA: MapTable = {
  title: 'Gota frente a pseudogota',
  columns: ['', 'Gota', 'Pseudogota'],
  rows: [
    ['Cristal', 'Urato monosódico', 'Pirofosfato cálcico'],
    ['Birrefringencia', 'Negativa', 'Positiva débil'],
  ],
}

test('tabla: celdas en texto plano (sin HTML ni invisibles), acotadas y con pocos saltos', () => {
  assert.equal(cleanCell('<img src=x onerror=alert(1)>Urato <b>monosódico</b>'), 'Urato monosódico')
  assert.equal(cleanCell('a​b‮c\u{E0041}'), 'abc')
  assert.equal(cleanCell('a\tb   c'), 'a b c')
  assert.equal(cleanCell('1\n\n\n2\n3\n4\n5'), '1\n2\n3\n4 5')
  assert.equal(cleanCell(42), '42')
  assert.equal(cleanCell({ x: 1 }), '')
  assert.equal(cleanCell('x'.repeat(500)).length, TABLE_LIMITS.maxCell)
})

test('tabla: sanitizeTable arregla filas irregulares, acota y rechaza lo que no es tabla', () => {
  const t = sanitizeTable({
    title: '<script>x</script>Título',
    columns: ['A', 'B', 'C'],
    rows: [['1'], ['1', '2', '3', '4', '5'], 'basura', [{ o: 1 }, 7, null]],
  })!
  assert.equal(t.title, 'Título')
  assert.deepEqual(t.rows, [['1', '', ''], ['1', '2', '3 / 4 / 5'], ['', '', ''], ['', '7', '']])
  assert.equal(sanitizeTable(null), null)
  assert.equal(sanitizeTable({ columns: [] }), null)
  assert.equal(sanitizeTable({ columns: 'A|B' }), null)
  const grande = sanitizeTable({
    columns: Array.from({ length: 20 }, (_, i) => `C${i}`),
    rows: Array.from({ length: 100 }, () => Array.from({ length: 20 }, () => 'x'.repeat(100))),
  })!
  assert.equal(grande.columns.length, TABLE_LIMITS.maxColumns)
  assert.ok(grande.rows.length <= TABLE_LIMITS.maxRows)
  assert.ok(grande.rows.flat().join('').length <= TABLE_LIMITS.maxTotal)
})

test('tabla: el label es una copia segura en texto (título, cabecera y filas)', () => {
  const l = tableToLabel({ title: 'A <b> & C', columns: ['x', 'y'], rows: [['1 < 2', 'línea\notra']] })
  assert.equal(l, '<b>A &lt;b&gt; &amp; C</b><br>x | y<br>1 &lt; 2 | línea otra')
  assert.equal(sanitizeLabelHtml(l), l)
  const larga = tableToLabel({ title: 'T', columns: ['a'], rows: Array.from({ length: 40 }, () => ['z'.repeat(150)]) })
  assert.ok(larga.length <= 4000 && larga.endsWith('…'))
})

test('tabla: insertar, borrar y mover filas y columnas', () => {
  let t = insertRow(TABLA, 1)
  assert.deepEqual(t.rows[1], ['', '', ''])
  t = moveRow(t, 2, -1)
  assert.equal(t.rows[1][0], 'Birrefringencia')
  t = removeRow(t, 2)
  assert.equal(t.rows.length, 2)
  t = insertColumn(t, 1)
  assert.deepEqual(t.columns, ['', '', 'Gota', 'Pseudogota'])
  assert.ok(t.rows.every((r) => r.length === 4))
  t = moveColumn(removeColumn(t, 1), 2, -1)
  assert.deepEqual(t.columns, ['', 'Pseudogota', 'Gota'])
  assert.equal(t.rows[0][1], 'Pirofosfato cálcico')
  assert.equal(removeColumn({ title: '', columns: ['a'], rows: [] }, 0).columns.length, 1)
  assert.equal(setCell(t, -1, 0, '<i>Rasgo</i>').columns[0], 'Rasgo')
  // Los límites no se pasan.
  const llena = { title: '', columns: Array(TABLE_LIMITS.maxColumns).fill('c'), rows: [] }
  assert.equal(insertColumn(llena, 0), llena)
})

test('tabla: geometría con ancho máximo, columnas mínimas y filas que crecen con el texto', () => {
  const g = tableGeometry(TABLA)
  assert.equal(g.colW.length, 3)
  assert.equal(g.rowH.length, 3)
  assert.ok(g.width >= TABLE_GEOMETRY.minWidth && g.width <= TABLE_GEOMETRY.maxWidth)
  const ancha = tableGeometry({ title: 'T', columns: ['a', 'b', 'c', 'd', 'e', 'f'], rows: [Array(6).fill('palabra '.repeat(30))] })
  assert.ok(ancha.width <= TABLE_GEOMETRY.maxWidth + 0.5)
  assert.ok(ancha.colW.every((w) => w >= TABLE_GEOMETRY.minCol - 0.5))
  assert.ok(ancha.rowH[1] > ancha.rowH[0] * 3, 'la fila con mucho texto es más alta')
  const size = estimateTableSize(TABLA)
  assert.ok(size.w > 100 && size.h > 60)
})

test('tabla: árbol v1 → grafo (estilo de contorno, label de copia) y el layout la mide', () => {
  const tree = {
    version: 1 as const,
    nodes: [
      { id: 'r', parentId: null, text: 'Microcristales', category: 'general' as const },
      { id: 't', parentId: 'r', text: 'Gota frente a pseudogota', category: 'diagnostico' as const, table: { columns: TABLA.columns, rows: TABLA.rows } },
    ],
  }
  const doc = sanitizeDoc(tree)
  assert.equal(doc.nodes[1].table?.title, 'Gota frente a pseudogota')
  const g = treeToGraph(doc)
  const n = g.nodes.find((x) => x.id === 't')!
  assert.deepEqual(n.data.table?.rows, TABLA.rows)
  assert.equal(n.data.label, tableToLabel(n.data.table!))
  // Aunque cuelgue de la raíz (nivel 1), contorno del color de la categoría y no relleno macizo.
  assert.equal(n.data.style.borderWidth, 2)
  assert.equal(n.data.style.color, '#FFFFFF')
  const boxes = computeLayout(doc)
  assert.ok((boxes.get('t')?.w ?? 0) > 200, 'la caja de la tabla es la de la tabla, no la de su título')
  // La raíz nunca es una tabla.
  const raiz = sanitizeDoc({ nodes: [{ id: 'r', parentId: null, text: 'x', table: TABLA }] })
  assert.equal(raiz.nodes[0].table, undefined)
})

test('tabla: sanitizeGraph regenera el label desde la tabla y descarta tablas rotas', () => {
  const style = newGraphDoc().nodes[0].data.style
  const g = sanitizeGraph({
    version: 2,
    nodes: [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: '<img src=x onerror=alert(1)>mentira', style, table: TABLA } },
      { id: 'b', position: { x: 0, y: 0 }, data: { label: 'Texto', style, table: { columns: 'roto' } } },
    ],
    edges: [],
  })
  assert.equal(g.nodes[0].data.label, tableToLabel(TABLA))
  assert.equal(g.nodes[1].data.table, undefined)
  assert.equal(g.nodes[1].data.label, 'Texto')
})

test('tabla: exportar e importar JSON la conserva; un mapa sin tablas no cambia', () => {
  const style = newGraphDoc().nodes[0].data.style
  const doc = {
    version: 2 as const,
    nodes: [
      { id: 'r', type: 'mindmap' as const, position: { x: 0, y: 0 }, data: { label: 'Raíz', style } },
      { id: 't', type: 'mindmap' as const, position: { x: 300, y: 0 }, data: { label: tableToLabel(TABLA), style, parentId: 'r', table: TABLA } },
    ],
    edges: [],
  }
  const back = parseMapFile(serializeMap('Mapa', doc)).doc as typeof doc
  assert.deepEqual(back.nodes[1].data.table, TABLA)
  // Un grafo sin tablas sale idéntico (no se re-guarda ningún mapa existente por esto).
  const sinTablas = { version: 2 as const, nodes: [doc.nodes[0]], edges: [] }
  assert.deepEqual(sanitizeGraph(sinTablas), sinTablas)
})

test('tabla: la lista la cuenta, la dibuja y encuentra el texto de sus celdas', () => {
  const style = newGraphDoc().nodes[0].data.style
  const s = summarizeDoc({
    version: 2,
    nodes: [
      { id: 'r', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'Raíz', style } },
      { id: 't', type: 'mindmap', position: { x: 300, y: 0 }, data: { label: 'x', style, parentId: 'r', table: TABLA } },
    ],
    edges: [],
  })
  assert.equal(s.tables, 1)
  assert.ok(s.text.includes('pirofosfato calcico'))
  const thumb = s.thumb!.nodes.find((n) => n.table)!
  assert.equal(thumb.table!.lines.length, 3)
})

// ---- Exportar una tabla (PDF/PNG comparten drawPage) ------------------------

import { drawPage, type Painter } from '@/lib/mapas/export/draw'

function recordingPainter() {
  const texts: { str: string; x: number; y: number; color: string; bold?: boolean }[] = []
  const shapes: { fill: string | null; stroke: string | null }[] = []
  let paths = 0
  const p: Painter = {
    measure: (text, font) => text.length * font.size * 0.55,
    beginPage() {},
    save() {},
    restore() {},
    clipRect() {},
    shape(_k, _r, fill, stroke) {
      shapes.push({ fill, stroke })
    },
    path(cmds) {
      for (const c of cmds) for (const v of c.slice(1)) assert.ok(Number.isFinite(v as number))
      paths += 1
    },
    text(str, x, y, font) {
      texts.push({ str, x, y, color: font.color, bold: font.bold })
    },
  }
  return { p, texts, shapes, paths: () => paths }
}

function tableSection(): Section {
  const g = tableGeometry(TABLA)
  return {
    title: '',
    edges: [],
    nodes: [
      {
        id: 't',
        parentId: null,
        x: 100,
        y: 50,
        w: g.width,
        h: g.height,
        shape: 'rectangle',
        fill: '#FFFFFF',
        stroke: '#D9A441',
        strokeWidth: 2,
        textColor: '#2A2420',
        fontFamily: 'Lexend',
        fontSize: 14,
        align: 'center',
        paragraphs: [],
        table: { ...TABLA, solid: true },
      },
    ],
  }
}

const PAGE_OPTS = { background: null, mapTitle: 'M', withTitle: false, bare: true, dateLabel: '', pageNo: 1, pageCount: 1, ink: '#000', muted: '#999' }

test('exportar: la tabla sale con todas sus celdas, dentro de su caja, con rejilla y franja', () => {
  const section = tableSection()
  const n = section.nodes[0]
  const page = { section, region: { x: 0, y: 0, w: 1000, h: 1000 }, scale: 1, w: 1000, h: 1000, area: { x: 0, y: 0, w: 1000, h: 1000 }, clip: false }
  const rec = recordingPainter()
  drawPage(rec.p, page, PAGE_OPTS)
  const all = rec.texts.map((t) => t.str).join(' ')
  for (const cell of [TABLA.title, ...TABLA.columns, ...TABLA.rows.flat()].filter(Boolean)) {
    for (const word of cell.split(' ')) assert.ok(all.includes(word), `falta «${word}» en «${all}»`)
  }
  for (const t of rec.texts) {
    assert.ok(t.x >= n.x && t.x <= n.x + n.w, `x fuera de la caja: ${t.str}`)
    assert.ok(t.y >= n.y && t.y <= n.y + n.h, `y fuera de la caja: ${t.str}`)
  }
  // Franja del título con el color de la categoría y título legible sobre ella (sobre el amarillo
  // de «Diagnóstico», oscuro; como en pantalla); cabecera en negrita.
  assert.ok(rec.shapes.some((s) => s.fill === '#D9A441'))
  assert.equal(rec.texts.find((t) => t.str.startsWith('Gota'))?.color, '#2A2420')
  assert.ok(rec.texts.find((t) => t.str === 'Pseudogota')?.bold)
  assert.ok(rec.paths() >= 2 + 3, 'rayas entre filas y entre columnas')
})

test('exportar con ahorro de tinta: la tabla pierde la franja rellena y el título va en color', () => {
  const section = applyInk(tableSection(), 'save')
  assert.equal(section.nodes[0].table?.solid, false)
  const page = { section, region: { x: 0, y: 0, w: 1000, h: 1000 }, scale: 1, w: 1000, h: 1000, area: { x: 0, y: 0, w: 1000, h: 1000 }, clip: false }
  const rec = recordingPainter()
  drawPage(rec.p, page, PAGE_OPTS)
  assert.ok(!rec.shapes.some((s) => s.fill && s.fill !== '#FFFFFF'), 'sin rellenos de color')
  assert.equal(rec.texts.find((t) => t.str.startsWith('Gota'))?.color, '#D9A441')
})

test('tabla: cabecera sin la celda de la esquina → se añade y las columnas no se corren', () => {
  const t = sanitizeTable({
    columns: ['UMS', 'PPCD', 'HA', 'OXCA'],
    rows: [
      ['Forma del cristal', 'Aguja', 'Romboidal pequeño', 'Muy pequeños', 'Bipiramidal'],
      ['Birrefringencia', 'Muy negativa', 'Débil positiva', 'No', 'Muy positiva'],
    ],
  })!
  assert.deepEqual(t.columns, ['', 'UMS', 'PPCD', 'HA', 'OXCA'])
  assert.deepEqual(t.rows[1], ['Birrefringencia', 'Muy negativa', 'Débil positiva', 'No', 'Muy positiva'])
  // Con la esquina ya puesta (o una sola fila larga entre varias), no se toca.
  assert.deepEqual(sanitizeTable({ columns: ['', 'A'], rows: [['x', '1'], ['y', '2']] })!.columns, ['', 'A'])
})
