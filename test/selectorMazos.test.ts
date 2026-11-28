// Selector de «guardar en un mazo»: la lista compartida (deckPickerStore) se pide una vez aunque la
// pidan varios, no se vuelve a pedir mientras está al día, se reordena solo al abrir y recoge los
// mazos creados sin pedir nada; y los helpers de studioDecks (pertenencia, 404, orden).
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  type StudioDeck,
  addQuestionToDeck,
  createStudioDeck,
  fetchQuestionMembership,
  markDeckUsed,
  sortDecksByLastUse,
} from '@/lib/studioDecks'
import {
  hasFreshPickerDecks,
  loadPickerDecks,
  markPickerDeckUsed,
  markPickerDecksStale,
  resetPickerDecks,
  sortPickerDecks,
} from '@/lib/studio/deckPickerStore'

import { loadMembershipBatch } from '@/lib/studio/membershipBatch'
import {
  getQuestionDecks,
  isQuestionMembershipKnown,
  markQuestionInDeck,
  resetSavedQuestions,
} from '@/lib/studio/savedQuestionsStore'

process.env.NEXT_PUBLIC_API_URL = 'http://api.prueba'

type Llamada = { url: string; method: string; body: unknown }
let llamadas: Llamada[] = []
let respuesta: (url: string, method: string, body: unknown) => { status: number; body: unknown } = () => ({
  status: 200,
  body: {},
})

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = init?.method ?? 'GET'
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  llamadas.push({ url, method, body })
  const r = respuesta(url, method, body)
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

const mazo = (id: string, last_used_at: string, extra: Partial<StudioDeck> = {}): StudioDeck => ({
  id,
  name: `Mazo ${id}`,
  auto_type: 'none',
  last_used_at,
  ...extra,
})

const SELECTOR = [
  mazo('a', '2026-11-28T10:00:00Z'),
  mazo('b', '2026-11-27T10:00:00Z'),
  mazo('fallos', '2026-11-28T11:00:00Z', { auto_type: 'failed_global' }),
]

beforeEach(() => {
  resetPickerDecks()
  resetSavedQuestions()
  llamadas = []
  respuesta = (url) =>
    url.includes('/decks/selector') ? { status: 200, body: { decks: SELECTOR } } : { status: 200, body: {} }
})

const pedidasDeLista = () => llamadas.filter((l) => l.url.includes('/decks/selector')).length

test('varios selectores a la vez: una sola petición, y sin el mazo de fallos', async () => {
  const [uno, dos, tres] = await Promise.all([loadPickerDecks('t'), loadPickerDecks('t'), loadPickerDecks('t')])
  assert.equal(pedidasDeLista(), 1)
  assert.deepEqual(uno.map((d) => d.id), ['a', 'b'])
  assert.equal(uno, dos)
  assert.equal(dos, tres)
})

test('al día no se vuelve a pedir; caducada, sí', async () => {
  await loadPickerDecks('t')
  assert.ok(hasFreshPickerDecks())
  await loadPickerDecks('t')
  assert.equal(pedidasDeLista(), 1)

  markPickerDecksStale()
  assert.equal(hasFreshPickerDecks(), false)
  await loadPickerDecks('t')
  assert.equal(pedidasDeLista(), 2)
})

test('una respuesta que llega después de caducar no pisa la lista', async () => {
  const fetchReal = globalThis.fetch
  // Respuesta retenida hasta que el test la suelta.
  const conRetraso = async (caducarAntes: boolean) => {
    let soltar: () => void = () => {}
    const espera = new Promise<void>((ok) => (soltar = ok))
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      await espera
      return fetchReal(...args)
    }) as typeof fetch
    const pedido = loadPickerDecks('t')
    if (caducarAntes) markPickerDecksStale()
    soltar()
    await pedido
  }
  try {
    await conRetraso(false)
    assert.equal(hasFreshPickerDecks(), true, 'sin caducar, la respuesta vale')
    resetPickerDecks()
    await conRetraso(true)
    assert.equal(hasFreshPickerDecks(), false, 'caducada en vuelo, la respuesta vieja no vale')
  } finally {
    globalThis.fetch = fetchReal
  }
})

test('guardar no mueve el mazo; al abrir de nuevo, sube', async () => {
  const lista = await loadPickerDecks('t')
  assert.deepEqual(lista.map((d) => d.id), ['a', 'b'])

  markPickerDeckUsed('b')
  const tras = await loadPickerDecks('t')
  assert.deepEqual(tras.map((d) => d.id), ['a', 'b'], 'con el popup abierto, quieto')

  sortPickerDecks()
  const alAbrir = await loadPickerDecks('t')
  assert.deepEqual(alAbrir.map((d) => d.id), ['b', 'a'])
  assert.equal(pedidasDeLista(), 1, 'todo sin volver a pedirla')
})

test('un mazo creado desde un selector entra arriba sin pedir la lista', async () => {
  await loadPickerDecks('t')
  respuesta = () => ({
    status: 201,
    body: { deck: { id: 'nuevo', name: 'Nuevo', auto_type: 'none', kind: 'questions', created_at: '2026-11-28T12:00:00Z' } },
  })
  await createStudioDeck('t', 'Nuevo')
  const lista = await loadPickerDecks('t')
  assert.deepEqual(lista.map((d) => d.id), ['nuevo', 'a', 'b'])
  assert.equal(lista[0].last_used_at, '2026-11-28T12:00:00Z')
  assert.equal(pedidasDeLista(), 1)
})

test('pertenencia: deckId -> id de fila, en texto', async () => {
  respuesta = () => ({ status: 200, body: { items: { a: 501, b: '7' } } })
  assert.deepEqual(await fetchQuestionMembership('t', 1415), { a: '501', b: '7' })
  assert.match(llamadas[0].url, /\/api\/studio\/decks\/membership\?questionId=1415$/)
})

test('guardar en un mazo que ya no existe lleva el 404 en el error', async () => {
  respuesta = () => ({ status: 404, body: { error: 'Mazo no encontrado' } })
  await assert.rejects(addQuestionToDeck('t', 'borrado', '1415'), (err: Error & { status?: number }) => {
    assert.equal(err.status, 404)
    assert.equal(err.message, 'Mazo no encontrado')
    return true
  })
})

// ---- Pertenencia en lote (fase 4) ----

const mir = Array.from({ length: 210 }, (_, i) => String(i + 1))
const lotes = () => llamadas.filter((l) => l.url.endsWith('/decks/membership/batch'))
// El servidor: la 1 está en dos mazos y la 2 en uno; el resto en ninguno (no vienen).
const servidor = () => ({ status: 200, body: { items: { '1': { a: 11, b: 12 }, '2': { a: 21 } } } })

test('lote: un MIR entero es UNA petición y todas quedan sabidas, también las que no están en ningún mazo', async () => {
  respuesta = servidor
  await loadMembershipBatch('t', mir)
  assert.equal(lotes().length, 1)
  assert.equal((lotes()[0].body as { questionIds: string[] }).questionIds.length, 210)
  assert.deepEqual(getQuestionDecks('1'), { a: '11', b: '12' })
  assert.deepEqual(getQuestionDecks('2'), { a: '21' })
  assert.deepEqual(getQuestionDecks('150'), {})
  assert.ok(mir.every((id) => isQuestionMembershipKnown(id)))

  await loadMembershipBatch('t', mir)
  assert.equal(lotes().length, 1, 'lo ya sabido no se vuelve a pedir')
})

test('lote: dos aperturas a la vez no piden dos veces la misma pregunta', async () => {
  respuesta = servidor
  const primeras = mir.slice(0, 10)
  const solapadas = mir.slice(5, 15)
  await Promise.all([loadMembershipBatch('t', primeras), loadMembershipBatch('t', solapadas)])
  const pedidas = lotes().flatMap((l) => (l.body as { questionIds: string[] }).questionIds)
  assert.equal(pedidas.length, 15, 'cada pregunta una sola vez')
  assert.equal(new Set(pedidas).size, 15)
  assert.ok(solapadas.every((id) => isQuestionMembershipKnown(id)))
})

test('lote: lo que guardas con el lote en vuelo no lo pisa la respuesta vieja', async () => {
  let soltar: () => void = () => {}
  const espera = new Promise<void>((ok) => (soltar = ok))
  const fetchReal = globalThis.fetch
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    await espera
    return fetchReal(...args)
  }) as typeof fetch
  respuesta = servidor
  try {
    const lote = loadMembershipBatch('t', mir)
    // Mientras tanto: «Guardar falladas» mete la 2 en el mazo c.
    markQuestionInDeck('2', 'c', '99')
    soltar()
    await lote
  } finally {
    globalThis.fetch = fetchReal
  }
  assert.deepEqual(getQuestionDecks('2'), { c: '99' }, 'se queda lo local')
  assert.equal(isQuestionMembershipKnown('2'), false, 'y sin confirmar: al abrirla se preguntará sola')
  assert.deepEqual(getQuestionDecks('1'), { a: '11', b: '12' }, 'las demás sí se aplican')
})

test('lote: si cambias de cuenta con el lote en vuelo, no se aplica nada', async () => {
  let soltar: () => void = () => {}
  const espera = new Promise<void>((ok) => (soltar = ok))
  const fetchReal = globalThis.fetch
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    await espera
    return fetchReal(...args)
  }) as typeof fetch
  respuesta = servidor
  try {
    const lote = loadMembershipBatch('t', mir)
    resetSavedQuestions()
    soltar()
    await lote
  } finally {
    globalThis.fetch = fetchReal
  }
  assert.deepEqual(getQuestionDecks('1'), {})
  assert.equal(isQuestionMembershipKnown('1'), false)
})

test('lote: por encima de 250 preguntas se trocea', async () => {
  respuesta = servidor
  await loadMembershipBatch('t', Array.from({ length: 260 }, (_, i) => String(i + 1)))
  assert.deepEqual(
    lotes().map((l) => (l.body as { questionIds: string[] }).questionIds.length),
    [250, 10],
  )
})

test('lote: si el servidor falla, rechaza y no da nada por sabido', async () => {
  respuesta = () => ({ status: 500, body: { error: 'x' } })
  await assert.rejects(loadMembershipBatch('t', mir.slice(0, 5)))
  assert.equal(isQuestionMembershipKnown('1'), false)
  respuesta = servidor
  await loadMembershipBatch('t', mir.slice(0, 5))
  assert.equal(lotes().length, 2, 'se puede volver a intentar')
})

test('orden local: igual que el del servidor y markDeckUsed no reordena', () => {
  const lista = [mazo('x', '2026-01-01T00:00:00Z'), mazo('y', '2026-02-01T00:00:00Z'), { id: 'z', name: 'z' }]
  assert.deepEqual(sortDecksByLastUse(lista).map((d) => d.id), ['y', 'x', 'z'])
  const usada = markDeckUsed(lista, 'x')
  assert.deepEqual(usada.map((d) => d.id), ['x', 'y', 'z'])
  assert.ok(Date.parse(usada[0].last_used_at!) > Date.parse('2026-02-01T00:00:00Z'))
})
