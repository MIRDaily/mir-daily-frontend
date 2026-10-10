// «Más de este tema» y «Rehacer este párrafo» en los resúmenes activos con IA: el texto del documento
// guardado con el borrador (saneado al leer, huérfanos), el fragmento de un tema o de un párrafo, dónde
// entran los nuevos y cómo se rehace y se deshace un párrafo en su sitio. Lo puro; lo de IndexedDB y la
// red se prueban en el navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { documentosHuerfanos, sanearDocumento, sanearParrafo, type ParrafoBorrador } from '@/lib/resumenes/borrador'
import {
  deshacerEnSitio,
  fragmentoDeParrafo,
  fragmentoDeTema,
  insertarNuevos,
  nivelesDeLista,
  nivelesDeOpcion,
  paginasDeFragmento,
  parrafosDeTema,
  rangosDeTemas,
  rehacerEnSitio,
  seccionesDelGrupo,
  temasMarcados,
  textoMas,
  vecinosDeTema,
} from '@/lib/resumenes/ampliar'
import type { Seccion } from '@/lib/mapas/ia/types'

const ARCHIVO = 'c'.repeat(64)
const H1 = 'a'.repeat(64)
const T = 'La causa más frecuente es la tiroiditis de Hashimoto, con anticuerpos anti-TPO.'
const hueco = { i: T.indexOf('tiroiditis'), f: T.indexOf('tiroiditis') + 'tiroiditis de Hashimoto'.length, n: 2 as const }

const parrafo = (key: string, tema: string, extra: Partial<ParrafoBorrador> = {}): ParrafoBorrador => ({ key, tema, texto: T, huecos: [hueco], incluir: true, ...extra })

// Un documento de 12 páginas: dos temas del libro (páginas 1-6 y 7-12).
const SECCIONES: Seccion[] = Array.from({ length: 12 }, (_, k) => ({ titulo: `Página ${k + 1}`, texto: `Texto de la página ${k + 1}. `.repeat(20), pagina: k + 1 }))
const DOC = { secciones: SECCIONES, temas: [{ titulo: 'Tiroides', desde: 0, hasta: 5 }, { titulo: 'Suprarrenal', desde: 6, hasta: 11 }] }

// ---------------------------------------------------------------------------
// El texto del documento guardado
// ---------------------------------------------------------------------------

test('sanearDocumento: reconstruye lo que vale y descarta lo que no', () => {
  const d = sanearDocumento({
    clave: `u1:${ARCHIVO}`,
    usuario: 'u1',
    hash: ARCHIVO,
    secciones: [{ texto: 'uno', pagina: 1, titulo: 'T', raro: 1 }, { texto: 'dos', pagina: 2 }],
    paginas: 2,
    unidad: 'diapositiva',
    temas: [{ titulo: 'Tema A', desde: 0, hasta: 1 }, { titulo: 'Fuera', desde: 1, hasta: 5 }, { titulo: '', desde: 0, hasta: 0 }],
    guardado: 5,
    otro: 'x',
  })
  assert.deepEqual(d, {
    clave: `u1:${ARCHIVO}`,
    usuario: 'u1',
    hash: ARCHIVO,
    secciones: [{ texto: 'uno', titulo: 'T', pagina: 1 }, { texto: 'dos', pagina: 2 }],
    paginas: 2,
    unidad: 'diapositiva',
    temas: [{ titulo: 'Tema A', desde: 0, hasta: 1 }],
    guardado: 5,
  })
})

test('sanearDocumento: null sin secciones, sin hash válido o sin usuario; páginas por defecto; temas fuera si se cayó una sección', () => {
  const base = { clave: 'u1:documento', usuario: 'u1', hash: 'documento', secciones: [{ texto: 'a' }] }
  assert.ok(sanearDocumento(base))
  assert.equal(sanearDocumento({ ...base, hash: 'abc' }), null)
  assert.equal(sanearDocumento({ ...base, secciones: [] }), null)
  assert.equal(sanearDocumento({ ...base, secciones: [{ titulo: 'sin texto' }] }), null)
  assert.equal(sanearDocumento({ ...base, usuario: 3 }), null)
  assert.equal(sanearDocumento(null), null)
  assert.equal(sanearDocumento(base)?.paginas, 1)
  // Una sección rota: los rangos ya no cuadran con las que quedan.
  const roto = sanearDocumento({ ...base, secciones: [{ texto: 'a' }, null, { texto: 'b' }], temas: [{ titulo: 'X', desde: 0, hasta: 1 }] })
  assert.equal(roto?.secciones.length, 2)
  assert.equal(roto?.temas, undefined)
})

test('documentosHuerfanos: los del usuario sin borrador vivo (no toca los de otros)', () => {
  const claves = [`u1:${ARCHIVO}`, `u1:${H1}`, 'u2:x', 'u1:documento', 7]
  assert.deepEqual(documentosHuerfanos(claves, 'u1', [`u1:${ARCHIVO}`]), [`u1:${H1}`, 'u1:documento'])
})

test('sanearParrafo: conserva la marca de nuevo', () => {
  assert.equal(sanearParrafo({ ...parrafo('a', 'X'), nuevo: true }, 'k')?.nuevo, true)
  assert.equal(sanearParrafo({ ...parrafo('a', 'X'), nuevo: 'sí' }, 'k')?.nuevo, undefined)
})

// ---------------------------------------------------------------------------
// Qué viaja
// ---------------------------------------------------------------------------

test('niveles: los de la generación (de los huecos) y los de cada opción', () => {
  const lista = [parrafo('a', 'X', { huecos: [{ ...hueco, n: 3 }] }), parrafo('b', 'X', { huecos: [{ ...hueco, n: 1 }] })]
  assert.deepEqual(nivelesDeLista(lista), [1, 3])
  assert.deepEqual(nivelesDeLista([]), [1, 2, 3, 4])
  assert.deepEqual(nivelesDeOpcion('todo', [1, 3]), [1, 3])
  assert.deepEqual(nivelesDeOpcion('dificiles', [1, 3]), [3, 4])
  assert.deepEqual(nivelesDeOpcion('faciles', [1, 3]), [1, 2])
})

test('parrafosDeTema y vecinosDeTema: por tema del libro y nombre; los del mismo tema del libro primero', () => {
  const lista = [
    parrafo('a', 'Hipotiroidismo', { grupo: 'Tiroides' }),
    parrafo('b', 'Addison', { grupo: 'Suprarrenal' }),
    parrafo('c', 'Hipotiroidismo', { grupo: 'Suprarrenal' }),
    parrafo('d', 'Graves', { grupo: 'Tiroides' }),
    parrafo('e', 'Hipotiroidismo', { grupo: 'Tiroides', incluir: false }),
  ]
  assert.deepEqual(parrafosDeTema(lista, 'Tiroides', 'Hipotiroidismo').map((p) => p.key), ['a', 'e'])
  assert.deepEqual(vecinosDeTema(lista, 'Tiroides', 'Hipotiroidismo'), ['Graves', 'Addison'])
})

test('fragmentoDeTema: las páginas de sus párrafos con una de margen, dentro de su tema del libro', () => {
  const ps = [parrafo('a', 'Hipotiroidismo', { grupo: 'Tiroides', ia: { pagina: 3 } }), parrafo('b', 'Hipotiroidismo', { grupo: 'Tiroides', ia: { pagina: 4 } })]
  assert.deepEqual(fragmentoDeTema(DOC, 'Tiroides', 'Hipotiroidismo', ps).map((s) => s.pagina), [2, 3, 4, 5])
  // Página 6 (la última del tema): el margen no se sale a la 7, que es de otro tema del libro.
  const borde = [parrafo('a', 'Bocio', { grupo: 'Tiroides', ia: { pagina: 6 } })]
  assert.deepEqual(fragmentoDeTema(DOC, 'Tiroides', 'Bocio', borde).map((s) => s.pagina), [5, 6])
  // Sin tema del libro conocido: el documento entero.
  assert.deepEqual(fragmentoDeTema({ secciones: SECCIONES }, 'Tiroides', 'Bocio', borde).map((s) => s.pagina), [5, 6, 7])
  // Sin páginas y el tema cabe entero: todo el tema del libro.
  assert.deepEqual(fragmentoDeTema(DOC, 'Suprarrenal', 'Addison', [parrafo('x', 'Addison', { grupo: 'Suprarrenal' })]).map((s) => s.pagina), [7, 8, 9, 10, 11, 12])
})

test('seccionesDelGrupo: por el nombre del tema del libro (sin tildes ni mayúsculas); si no está, el documento', () => {
  assert.equal(seccionesDelGrupo(DOC, 'TIROIDES').length, 6)
  assert.equal(seccionesDelGrupo(DOC, 'Otro').length, 12)
  assert.equal(seccionesDelGrupo(DOC, '').length, 12)
})

test('fragmentoDeParrafo: su página ±1; sin página, el de su tema', () => {
  const p = parrafo('a', 'Addison', { grupo: 'Suprarrenal', ia: { pagina: 9 } })
  assert.deepEqual(fragmentoDeParrafo(DOC, p, [p]).map((s) => s.pagina), [8, 9, 10])
  const sin = parrafo('b', 'Addison', { grupo: 'Suprarrenal' })
  const otro = parrafo('c', 'Addison', { grupo: 'Suprarrenal', ia: { diapositiva: 11 } })
  assert.deepEqual(fragmentoDeParrafo(DOC, sin, [sin, otro]).map((s) => s.pagina), [10, 11, 12])
})

test('paginasDeFragmento: las distintas, o las secciones, al menos 1', () => {
  assert.equal(paginasDeFragmento(SECCIONES.slice(2, 5)), 3)
  assert.equal(paginasDeFragmento([{ texto: 'a' }, { texto: 'b' }]), 2)
  assert.equal(paginasDeFragmento([]), 1)
})

test('temasMarcados y rangosDeTemas: el rango en el documento de cada tema que salió, por índice o por título', () => {
  const indice = [
    { titulo: 'Tiroides', desde: 0, hasta: 5 },
    { titulo: 'Paratiroides', desde: 6, hasta: 7 },
    { titulo: 'Suprarrenal', desde: 8, hasta: 11 },
  ]
  const enviados = temasMarcados(indice, new Set([1, 2, 9]))
  assert.deepEqual(enviados.map((t) => t.titulo), ['Tiroides', 'Suprarrenal'])
  // El servidor devuelve el índice en lo enviado; el título puede venir algo distinto (acotado, sin tildes).
  assert.deepEqual(rangosDeTemas(enviados, [{ i: 1, titulo: 'SUPRARRENAL' }, { i: 0, titulo: 'Tiroides' }]), [
    { titulo: 'SUPRARRENAL', desde: 8, hasta: 11 },
    { titulo: 'Tiroides', desde: 0, hasta: 5 },
  ])
  // Índice que no cuadra (el servidor quitó un tema vacío): por el título.
  assert.deepEqual(rangosDeTemas(enviados, [{ i: 0, titulo: 'Suprarrenal' }]), [{ titulo: 'Suprarrenal', desde: 8, hasta: 11 }])
  assert.deepEqual(rangosDeTemas(enviados, [{ i: 5, titulo: 'Nada' }]), [])
})

// ---------------------------------------------------------------------------
// Dónde entran y cómo se rehacen
// ---------------------------------------------------------------------------

test('insertarNuevos: tras el último del tema, con su tema del libro y su doc, marcados y sin chocar claves', () => {
  const lista = [
    parrafo('a', 'Hipo', { grupo: 'Tiroides', doc: H1 }),
    parrafo('b', 'Hipo', { grupo: 'Tiroides', doc: H1 }),
    parrafo('c', 'Graves', { grupo: 'Tiroides', doc: H1 }),
    parrafo('mz-0', 'Hipo', { grupo: 'Suprarrenal' }),
  ]
  const nuevos = [parrafo('m0', 'Otro nombre', { doc: 'f'.repeat(64), incluirParecido: true, incluir: false }), parrafo('m1', 'Hipo')]
  const r = insertarNuevos(lista, 'Tiroides', 'Hipo', nuevos, 'z')
  assert.deepEqual(r.lista.map((p) => p.key), ['a', 'b', 'mz-1', 'mz-2', 'c', 'mz-0'])
  assert.equal(r.primera, 'mz-1')
  const n = r.lista[2]
  assert.equal(n.tema, 'Hipo')
  assert.equal(n.grupo, 'Tiroides')
  assert.equal(n.doc, H1)
  assert.equal(n.incluir, true)
  assert.equal(n.nuevo, true)
  assert.equal(n.incluirParecido, undefined)
  // Determinista: mismo sello, mismo resultado (el actualizador de React puede llamarse dos veces).
  assert.deepEqual(insertarNuevos(lista, 'Tiroides', 'Hipo', nuevos, 'z'), r)
  // Sin tema del libro y sin doc: no se inventan.
  const suelto = insertarNuevos([parrafo('a', 'X')], '', 'X', [parrafo('n', 'X')], 's')
  assert.equal(suelto.lista[1].grupo, undefined)
  assert.equal(suelto.lista[1].doc, undefined)
  assert.equal(insertarNuevos(lista, 'Tiroides', 'Hipo', [], 'z').lista, lista)
})

test('rehacerEnSitio y deshacerEnSitio: misma clave, tema, doc e «incluir»; vuelve la anterior', () => {
  const T2 = 'Con anticuerpos anti-TPO, la causa más frecuente es la tiroiditis de Hashimoto.'
  const h2 = { i: T2.indexOf('tiroiditis'), f: T2.indexOf('tiroiditis') + 'tiroiditis de Hashimoto'.length, n: 2 as const }
  const original = parrafo('a', 'Hipo', { grupo: 'Tiroides', doc: H1, ia: { pagina: 3, dudoso: 'anclaje' }, incluirParecido: true, incluir: false })
  const lista = [parrafo('x', 'Hipo'), original]
  const hecha = rehacerEnSitio(lista, 'a', { texto: T2, huecos: [h2], ia: { pagina: 4 } })
  assert.equal(hecha[0], lista[0])
  assert.deepEqual(hecha[1], { key: 'a', tema: 'Hipo', texto: T2, huecos: [h2], incluir: false, grupo: 'Tiroides', doc: H1, ia: { pagina: 4 } })
  // Sin origen nuevo: no se queda el viejo.
  assert.equal(rehacerEnSitio(lista, 'a', { texto: T2, huecos: [h2] })[1].ia, undefined)
  // Deshacer: la anterior, con el «incluir» de ahora.
  const marcada = hecha.map((p) => (p.key === 'a' ? { ...p, incluir: true } : p))
  assert.deepEqual(deshacerEnSitio(marcada, 'a', original)[1], { ...original, incluir: true })
})

test('textoMas', () => {
  assert.equal(textoMas(3, 0), '+3 nuevos')
  assert.equal(textoMas(1, 1), '+1 nuevo · 1 quitado por repetir uno que ya tenías')
  assert.equal(textoMas(5, 2), '+5 nuevos · 2 quitados por repetir uno que ya tenías')
})
