// Flashcards con IA III (paquete 2, navegador): escalera de dificultad (saneado, textos, qué se ha
// desbloqueado), «Más de este tema» (dónde entran las nuevas, qué viaja), el borrador con su
// documento, y el mapa entero (bloques, envío, el nodo de un tema).
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { desbloqueados, hayEscalera, nombresNiveles, resumenEscalera, sanearEscalera, textoDesbloqueo, textoFalta } from '@/lib/flashcards/escalera'
import {
  acotarFragmento,
  borradores,
  envioDeBloques,
  insertarNuevas,
  mapaEnteroParaFlashcards,
  nodoDeTema,
  paginasDeTema,
  tarjetasDeTema,
  vecinosDeTema,
  paraGuardar,
  raizDelMapa,
} from '@/lib/flashcards/ia/tarjetas'
import { sanearBorrador, sanearDocumentoBorrador } from '@/lib/flashcards/ia/borrador'
import type { NodoMapa } from '@/lib/mapas/ia/rama'

// ---------- escalera ----------

const RAW = {
  topics: [
    {
      topic: 'Arteritis de células gigantes',
      levels: [
        { level: 3, total: 5, mastered: 0, lowerTotal: 20, lowerMastered: 12, needed: 16, unlocked: false },
        { level: 1, total: 10, mastered: 8, lowerTotal: 0, lowerMastered: 0, needed: 0, unlocked: true },
        { level: 2, total: 10, mastered: 4, lowerTotal: 10, lowerMastered: 8, needed: 8, unlocked: true },
        { level: 2, total: 99 },
      ],
    },
    { topic: null, levels: [{ level: 1, total: 2, mastered: 0, lowerTotal: 0, lowerMastered: 0, needed: 0, unlocked: 'true' }] },
    { topic: 'Vacío', levels: [{ level: 9 }] },
  ],
}

test('sanearEscalera: niveles válidos sin repetir y en orden; abierto solo si es true; temas vacíos fuera', () => {
  const e = sanearEscalera(RAW)
  assert.equal(e.topics.length, 2)
  assert.deepEqual(e.topics[0].levels.map((l) => l.level), [1, 2, 3])
  assert.equal(e.topics[0].levels[1].total, 10, 'el nivel repetido se ignora')
  assert.equal(e.topics[1].topic, null)
  assert.equal(e.topics[1].levels[0].unlocked, false)
  assert.deepEqual(sanearEscalera('basura'), { topics: [] })
  assert.equal(hayEscalera(e), true)
  assert.equal(hayEscalera({ topics: [e.topics[1]] }), false, 'un solo nivel: nada que escalar')
})

test('textos: «Difícil: 12 de 20 dominadas de fácil y media», y el escalón anterior cerrado', () => {
  const e = sanearEscalera(RAW)
  const t = e.topics[0]
  assert.equal(nombresNiveles([1, 2, 3]), 'fácil, media y difícil')
  assert.equal(textoFalta(t, t.levels[2]), '12 de 20 dominadas de fácil y media (hacen falta 16)')
  // Lo de abajo ya suma lo que hace falta pero la media está cerrada (se estudió sin escalera).
  const camino = { topic: 'X', levels: [
    { level: 1 as const, total: 5, mastered: 3, lowerTotal: 0, lowerMastered: 0, needed: 0, unlocked: true },
    { level: 2 as const, total: 5, mastered: 5, lowerTotal: 5, lowerMastered: 3, needed: 4, unlocked: false },
    { level: 3 as const, total: 5, mastered: 0, lowerTotal: 10, lowerMastered: 8, needed: 8, unlocked: false },
  ] }
  assert.equal(textoFalta(camino, camino.levels[2]), '8 de 10 dominadas de fácil y media; antes hay que abrir media')
  assert.deepEqual(resumenEscalera({ topics: [camino] }), { abiertas: 5, cerradas: 10, nivelesCerrados: 2 })
})

test('desbloqueados: solo lo que estaba cerrado y ahora está abierto', () => {
  const antes = sanearEscalera(RAW)
  const despues = sanearEscalera({
    topics: [
      { topic: 'Arteritis de células gigantes', levels: [
        { level: 1, total: 10, mastered: 9, unlocked: true },
        { level: 2, total: 10, mastered: 8, unlocked: true },
        { level: 3, total: 5, mastered: 0, unlocked: true },
        { level: 4, total: 3, mastered: 0, unlocked: true },
      ] },
      { topic: null, levels: [{ level: 1, total: 2, unlocked: true }] },
    ],
  })
  const d = desbloqueados(antes, despues)
  // El 3 se abrió; el 4 es nuevo (no estaba antes): no cuenta. El de sin tema estaba «cerrado» por
  // un valor no válido, pero no tenía más que un nivel: sí cuenta (estaba y ahora está abierto).
  assert.deepEqual(d, [{ topic: 'Arteritis de células gigantes', level: 3 }, { topic: null, level: 1 }])
  assert.equal(textoDesbloqueo(d.slice(0, 1)), 'Has desbloqueado Difícil en Arteritis de células gigantes')
  assert.equal(textoDesbloqueo(d), 'Has desbloqueado Difícil en Arteritis de células gigantes y Fácil')
  assert.equal(textoDesbloqueo([]), '')
  assert.deepEqual(desbloqueados(null, despues), [])
})

// ---------- «Más de este tema» ----------

const LISTA = [
  ...borradores([
    { tema: 'ACG', nivel: 1, pregunta: '¿Edad?', respuesta: '>50', ia: { pagina: 4 } },
    { tema: 'ACG', nivel: 3, pregunta: '¿Dosis?', respuesta: '1 mg/kg', ia: { pagina: 5 } },
  ], 'a', 'Tema 3'),
  ...borradores([{ tema: 'Takayasu', nivel: 1, pregunta: '¿Sexo?', respuesta: 'Mujer', ia: { diapositiva: 9 } }], 'b', 'Tema 3'),
]

test('tarjetasDeTema y paginasDeTema: lo del tema (también lo quitado), con su respuesta', () => {
  const l = LISTA.map((b, i) => (i === 1 ? { ...b, incluir: false } : b))
  assert.deepEqual(tarjetasDeTema(l, 'ACG'), [{ pregunta: '¿Edad?', respuesta: '>50' }, { pregunta: '¿Dosis?', respuesta: '1 mg/kg' }])
  assert.deepEqual(paginasDeTema(l, 'ACG'), [4, 5])
  assert.deepEqual(paginasDeTema(l, 'Takayasu'), [9])
})

test('vecinosDeTema: los demás temas, primero los del mismo tema del libro, sin repetir', () => {
  const l = [
    ...LISTA,
    ...borradores([{ tema: 'Behçet', nivel: 1, pregunta: '¿p?', respuesta: 'r' }], 'c', 'Tema 9'),
    ...borradores([{ tema: 'Takayasu', nivel: 2, pregunta: '¿q?', respuesta: 's' }], 'd', 'Tema 3'),
  ]
  assert.deepEqual(vecinosDeTema(l, 'ACG'), ['Takayasu', 'Behçet'])
  assert.deepEqual(vecinosDeTema(l, 'Behçet'), ['ACG', 'Takayasu'])
  assert.deepEqual(vecinosDeTema(l, 'ACG', 1), ['Takayasu'])
})

test('insertarNuevas: tras la última del tema, marcadas como nuevas, con su grupo y claves únicas', () => {
  const nuevas = [
    { tema: 'otro nombre', nivel: 2 as const, pregunta: '¿Biopsia?', respuesta: 'Temporal' },
    { tema: 'ACG', nivel: 4 as const, pregunta: '¿Halo?', respuesta: 'Ecografía' },
  ]
  const r = insertarNuevas(LISTA, 'ACG', nuevas)
  assert.equal(r.length, 5)
  assert.deepEqual(r.map((b) => b.pregunta), ['¿Edad?', '¿Dosis?', '¿Biopsia?', '¿Halo?', '¿Sexo?'])
  assert.ok(r[2].nueva && r[3].nueva && !r[0].nueva)
  assert.equal(r[2].tema, 'ACG', 'el tema es el pedido')
  assert.equal(r[2].grupo, 'Tema 3')
  assert.equal(new Set(r.map((b) => b.key)).size, 5)
  assert.equal(LISTA.length, 3, 'no muta la lista')
  assert.equal(insertarNuevas(LISTA, 'ACG', []), LISTA)
  assert.deepEqual(insertarNuevas(LISTA, 'Nuevo', nuevas.slice(0, 1)).at(-1)?.tema, 'Nuevo')
})

test('borrador: conserva «nueva» y el hash del documento; el texto guardado se sanea', () => {
  const b = sanearBorrador({
    clave: 'u1:documento', usuario: 'u1', origen: { tipo: 'documento' }, titulo: 'V', fuente: {}, fallidos: [],
    lista: [{ key: 'm1', tema: 'ACG', nivel: 2, pregunta: '¿p?', respuesta: 'r', incluir: true, nueva: true }],
    documento: { hash: 'a'.repeat(64), nombre: 'Tema_03.pdf' }, caduca: 9,
  })!
  assert.equal(b.lista[0].nueva, true)
  assert.deepEqual(b.documento, { hash: 'a'.repeat(64), nombre: 'Tema_03.pdf' })
  assert.equal(sanearBorrador({ ...b, documento: { hash: 'no-es-un-hash' } })?.documento, undefined)

  const d = sanearDocumentoBorrador({
    clave: 'u1:documento', hash: 'b'.repeat(64), nombre: 'X.pdf', caduca: 5, unidad: 'página',
    secciones: [{ texto: 'Arteritis', pagina: 3, titulo: 'T' }, { texto: 7 }, { texto: 'Otra', pagina: 1.5 }],
  })!
  assert.deepEqual(d.secciones, [{ texto: 'Arteritis', titulo: 'T', pagina: 3 }, { texto: 'Otra' }])
  assert.equal(d.unidad, 'página')
  assert.equal(sanearDocumentoBorrador({ clave: 'x', hash: 'h', secciones: [], caduca: 1 }), null)
})

// ---------- mapa entero ----------

const nodo = (id: string, label: string, parentId: string | undefined, y: number, pagina?: number): NodoMapa => ({
  id,
  position: { x: 0, y },
  data: { label, parentId, style: {} as NodoMapa['data']['style'], ...(pagina ? { ia: { anclaje: 1, pagina } } : {}) },
})
const MAPA: NodoMapa[] = [
  nodo('suelto', 'Nota suelta', undefined, -50),
  nodo('r', 'Vasculitis', undefined, 0),
  nodo('pv', 'Pequeño vaso', 'r', 40),
  nodo('gv', 'Grandes vasos', 'r', 10),
  nodo('acg', 'Arteritis de células gigantes', 'gv', 20),
  nodo('h1', 'Clínica: cefalea temporal', 'acg', 30, 2),
  nodo('h2', 'Tratamiento: glucocorticoides', 'acg', 31, 2),
  nodo('gpa', 'Granulomatosis con poliangeítis', 'pv', 50),
  nodo('h3', 'Clínica: nariz en silla de montar', 'gpa', 60, 9),
]
const DOC = Array.from({ length: 12 }, (_, i) => ({ texto: `Página ${i + 1}. ${'texto '.repeat(200)}`, pagina: i + 1 }))

test('raizDelMapa: el nodo sin padre del que cuelga más (no una nota suelta)', () => {
  assert.equal(raizDelMapa(MAPA), 'r')
  assert.equal(raizDelMapa([]), null)
})

test('mapaEnteroParaFlashcards: cabe entero con el documento; y sus bloques de arriba abajo con su fragmento', () => {
  const grande = mapaEnteroParaFlashcards(MAPA, 'r', DOC, 1_000_000)!
  assert.equal(grande.cabeEntero, true)
  assert.equal(grande.todo.mapa[0].t, 'Vasculitis')
  assert.deepEqual(grande.bloques.map((b) => b.id), ['gv', 'pv'], 'orden de lectura (por altura)')
  assert.deepEqual(grande.bloques[0].fragmento.map((s) => s.pagina), [1, 2, 3], 'páginas del bloque con una de margen')
  assert.deepEqual(grande.bloques[1].fragmento.map((s) => s.pagina), [8, 9, 10])
  // Un bloque que es un tema largo: TODAS sus páginas (la regla de las ramas, mediana ±3, perdía los extremos).
  const largo: NodoMapa[] = [nodo('r', 'Libro', undefined, 0), nodo('t', 'Tema largo', 'r', 10), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => nodo(`h${p}`, `Dato ${p}`, 't', 20 + p, p))]
  assert.deepEqual(mapaEnteroParaFlashcards(largo, 'r', DOC, 1_000_000)!.bloques[0].fragmento.map((s) => s.pagina), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const corto = mapaEnteroParaFlashcards(MAPA, 'r', DOC, 5000)!
  assert.equal(corto.cabeEntero, false)
  const sinDoc = mapaEnteroParaFlashcards(MAPA, 'r', null, 5000)!
  assert.equal(sinDoc.cabeEntero, true, 'el mapa solo sí cabe')
  assert.deepEqual(sinDoc.bloques[0].fragmento, [])
})

test('envioDeBloques: la raíz con los bloques debajo y los fragmentos sin repetir, en orden del documento', () => {
  const { bloques } = mapaEnteroParaFlashcards(MAPA, 'r', DOC, 1_000_000)!
  const e = envioDeBloques('Vasculitis', [bloques[1], bloques[0]], DOC)
  assert.deepEqual(e.mapa.slice(0, 3), [{ d: 0, t: 'Vasculitis' }, { d: 1, t: 'Pequeño vaso' }, { d: 2, t: 'Granulomatosis con poliangeítis' }])
  assert.deepEqual(e.secciones.map((s) => s.pagina), [1, 2, 3, 8, 9, 10])
  assert.equal(e.hojas, 3)
  const solo = envioDeBloques('Vasculitis', [bloques[0]], DOC)
  assert.equal(solo.hojas, 2)
  assert.ok(solo.chars < e.chars)
})

test('nodoDeTema: el nodo del tema (igual o el más parecido), dentro de la rama; una hoja da su padre', () => {
  assert.equal(nodoDeTema(MAPA, 'arteritis de celulas gigantes'), 'acg')
  assert.equal(nodoDeTema(MAPA, 'Granulomatosis con poliangeítis (Wegener)'), 'gpa')
  assert.equal(nodoDeTema(MAPA, 'Granulomatosis con poliangeítis', 'gv'), null, 'fuera de la rama de origen')
  assert.equal(nodoDeTema(MAPA, 'Clínica: cefalea temporal'), 'acg', 'una hoja: su padre')
  assert.equal(nodoDeTema(MAPA, 'Lupus'), null)
})

test('paraGuardar: desde un mapa, cada tarjeta con el nodo de su tema (si lo tiene); si no, el de la rama', () => {
  const lista = borradores([
    { tema: 'ACG', nivel: 1, pregunta: '¿Edad?', respuesta: '>50', nodeId: 'acg' },
    { tema: 'Otro', nivel: 2, pregunta: '¿x?', respuesta: 'y' },
  ])
  const [a, b] = paraGuardar(lista, { mapId: 'm1', nodeId: 'r' })
  assert.equal(a.source?.nodeId, 'acg')
  assert.equal(b.source?.nodeId, 'r')
  const guardado = sanearBorrador({ clave: 'u:mapa:m1', usuario: 'u', origen: { tipo: 'mapa', mapId: 'm1' }, titulo: 'V', fuente: {}, fallidos: [], lista, caduca: 1 })!
  assert.equal(guardado.lista[0].nodeId, 'acg', 'el borrador lo conserva')
})

test('acotarFragmento: quita secciones de los extremos hasta que quepa', () => {
  const mapa = [{ d: 0, t: 'ACG' }]
  const f = DOC.slice(0, 5)
  const uno = DOC[0].texto.length
  assert.equal(acotarFragmento(mapa, f, 100_000).length, 5)
  assert.equal(acotarFragmento(mapa, f, uno * 3 + 10).length, 3)
  assert.deepEqual(acotarFragmento(mapa, f, 10), [])
})
