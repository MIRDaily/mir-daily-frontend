// Añadir un documento a un mapa existente (informe 76): nombres equivalentes, hojas repetidas,
// reparto por faceta, plan y aplicación (debajo de lo que había, marcado para revisar).
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aplicarAnadido, contenidoEn, facetaDe, mismoNombre, planAnadir, repetida } from '@/lib/mapas/ia/anadir'
import { DEFAULT_GRAPH_STYLE } from '@/lib/mapas/graph'
import type { NodoMapa, LineaMapa } from '@/lib/mapas/ia/rama'
import type { MapDoc } from '@/lib/mapas/types'

test('mismoNombre y contenidoEn: mismo bloque o enfermedad con otras palabras', () => {
  assert.ok(mismoNombre('Hiperuricemia y gota', 'hiperuricemia y GOTA'))
  assert.ok(mismoNombre('Arteritis de células gigantes', 'Arteritis de células gigantes (de la temporal)'))
  assert.ok(!mismoNombre('Gota', 'Condrocalcinosis'))
  assert.ok(contenidoEn('Gota', 'Hiperuricemia y gota'))
  assert.ok(!contenidoEn('Pseudogota', 'Hiperuricemia y gota'))
  assert.equal(facetaDe('Tratamiento del ataque: colchicina'), 'tratamiento')
  assert.equal(facetaDe('Sin faceta'), null)
})

test('repetida: casi igual y sin nada nuevo → fuera; con cifra o dos palabras nuevas → dentro', () => {
  const ya = ['Reductor de uricemia: objetivo <6 mg/dl, y <5 mg/dl si enfermedad tofácea', 'Ecografía: depósito lineal hiperecoico (signo del doble contorno)']
  const vocab = new Set(['urato', 'tofos'])
  assert.ok(repetida('Tratamiento hipouricemiante: objetivo urato menor de 6 mg/dl y menor de 5 mg/dl si tofos', ya, vocab))
  assert.ok(!repetida('Imagen: ecografía con signo del doble contorno y TC de doble energía (DECT)', ya, vocab))
  assert.ok(!repetida('Objetivo: urato menor de 4 mg/dl', ya, vocab)) // una cifra que no estaba
  assert.ok(!repetida('Clínica: podagra nocturna', ya, vocab))
})

const nodo = (id: string, label: string, parentId: string | undefined, x: number, y: number): NodoMapa => ({
  id,
  position: { x, y },
  measured: { width: 160, height: 44 },
  data: { label, ...(parentId ? { parentId } : {}), style: { ...DEFAULT_GRAPH_STYLE }, category: 'general' },
})

// Mapa existente: el bloque de la gota va por aspectos, sin un nodo «Gota».
const MAPA: NodoMapa[] = [
  nodo('r', 'Artritis por microcristales', undefined, 0, 0),
  nodo('g', 'Hiperuricemia y gota', 'r', 300, 0),
  nodo('gc', 'Manifestaciones clínicas', 'g', 600, -100),
  nodo('gc1', 'Artritis gotosa aguda: monoartritis de inicio brusco', 'gc', 900, -100),
  nodo('gt', 'Tratamiento', 'g', 600, 100),
  nodo('gt1', 'Tratamiento: alopurinol, febuxostat', 'gt', 900, 80),
  nodo('gt2', 'Tratamiento: colchicina en la crisis', 'gt', 900, 130),
  nodo('c', 'Condrocalcinosis', 'r', 300, 300),
  nodo('c1', 'Definición: depósito de pirofosfato cálcico', 'c', 600, 300),
]
const LINEAS: LineaMapa[] = MAPA.filter((n) => n.data.parentId).map((n) => ({ id: `e-${n.data.parentId}-${n.id}`, source: n.data.parentId!, target: n.id }))

// Lo que devuelve el servidor para el documento nuevo (con la guía).
const NUEVO: MapDoc = {
  version: 1,
  nodes: [
    { id: 'n1', parentId: null, text: 'Artritis por microcristales', category: 'general' },
    { id: 'n2', parentId: 'n1', text: 'Hiperuricemia y gota', category: 'general' },
    { id: 'n3', parentId: 'n2', text: 'Gota', category: 'general' },
    { id: 'n4', parentId: 'n3', text: 'Tratamiento hipouricemiante', category: 'general', ia: { subgrupo: true } },
    { id: 'n5', parentId: 'n4', text: 'Tratamiento: HLA-B*5801 antes del alopurinol en asiáticos', category: 'tratamiento', ia: { pagina: 3 } },
    { id: 'n6', parentId: 'n4', text: 'Tratamiento: alopurinol y febuxostat', category: 'tratamiento' },
    { id: 'n7', parentId: 'n3', text: 'Clínica: podagra de madrugada', category: 'clinica' },
    { id: 'n8', parentId: 'n1', text: 'Artropatía por hidroxiapatita', category: 'general' },
    { id: 'n9', parentId: 'n8', text: 'Clínica: hombro calcificante', category: 'clinica' },
  ],
}

test('planAnadir: cada cosa a su sitio, repetidos fuera, lo que no encaja como bloque nuevo', () => {
  const plan = planAnadir(MAPA, NUEVO)
  const donde = Object.fromEntries(plan.anadidos.map((a) => [a.ruta.slice(1).join(' › ') || '(raíz)', a.doc.nodes.slice(1).map((n) => n.text)]))
  assert.deepEqual(donde['Hiperuricemia y gota › Tratamiento'], ['Tratamiento: HLA-B*5801 antes del alopurinol en asiáticos'])
  assert.deepEqual(donde['Hiperuricemia y gota › Manifestaciones clínicas'], ['Clínica: podagra de madrugada'])
  assert.deepEqual(donde['(raíz)'], ['Artropatía por hidroxiapatita', 'Clínica: hombro calcificante'])
  assert.deepEqual(plan.repetidas, ['Tratamiento: alopurinol y febuxostat'])
  assert.equal(plan.total, 4)
})

test('aplicarAnadido: lo de antes se queda; lo nuevo, debajo, del mismo lado y pendiente de revisar con su documento', () => {
  const plan = planAnadir(MAPA, NUEVO)
  let k = 0
  const r = aplicarAnadido(MAPA, LINEAS, plan, { nuevoId: () => `x${++k}`, origen: 'Clase.pptx' })!
  assert.equal(r.nodes.length, MAPA.length + 4)
  assert.ok(MAPA.every((n) => r.nodes.some((m) => m.id === n.id)))
  const hla = r.nodes.find((n) => n.data.label.includes('HLA'))!
  assert.equal(hla.data.parentId, 'gt')
  assert.ok(hla.position.y > 130 + 44, 'debajo de lo que ya colgaba de Tratamiento')
  assert.ok(hla.position.x > 600)
  assert.equal(hla.data.ia?.dudoso, 'nuevo')
  assert.equal(hla.data.ia?.seccion, 'Clase.pptx, pág. 3')
  assert.equal(hla.data.ia?.pagina, undefined)
  assert.equal(r.edges.filter((e) => r.nuevos.includes(e.target)).length, 4)
})

test('planAnadir: un bloque con otro nombre (sinónimo) va al bloque que trata de lo mismo', () => {
  const mapa: NodoMapa[] = [
    nodo('r', 'Microcristales', undefined, 0, 0),
    nodo('c', 'Condrocalcinosis', 'r', 300, 0),
    nodo('c1', 'Definición: depósito de cristales de pirofosfato cálcico dihidratado', 'c', 600, 0),
    nodo('c2', 'Clínica: pseudogota en rodilla y muñeca', 'c', 600, 50),
    nodo('g', 'Gota', 'r', 300, 300),
    nodo('g1', 'Definición: depósito de urato monosódico', 'g', 600, 300),
  ]
  const nuevo: MapDoc = {
    version: 1,
    nodes: [
      { id: 'n1', parentId: null, text: 'Microcristales', category: 'general' },
      { id: 'n2', parentId: 'n1', text: 'Enfermedad por depósito de pirofosfato cálcico', category: 'general' },
      { id: 'n3', parentId: 'n2', text: 'Asociación: hemocromatosis e hiperparatiroidismo en la pseudogota', category: 'etiologia' },
      { id: 'n4', parentId: 'n2', text: 'Diagnóstico: cristales romboidales de pirofosfato con birrefringencia positiva débil', category: 'diagnostico' },
    ],
  }
  const plan = planAnadir(mapa, nuevo)
  assert.deepEqual(plan.anadidos.map((a) => a.ruta.slice(1).join(' › ')), ['Condrocalcinosis'])
})
