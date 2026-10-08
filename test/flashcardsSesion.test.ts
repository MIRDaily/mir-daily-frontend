// Ajustes de la sesión de estudio de un grupo de flashcards (lib/flashcards/sesion.ts): qué tarjetas
// coinciden (con las mismas definiciones que el servidor), qué se manda al empezar y el saneado.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AJUSTES_POR_DEFECTO, coinciden, coincideSolo, paraEmpezar, sanearAjustes, temasDelGrupo, type AjustesSesion } from '@/lib/flashcards/sesion'
import type { Flashcard } from '@/lib/studioFlashcards'
import type { Escalera } from '@/lib/flashcards/escalera'

let n = 0
const carta = (topic: string | null, level: 1 | 2 | 3 | 4 | null, status: Flashcard['status'], isDue: boolean): Flashcard => ({
  itemId: ++n, flashcardId: `f${n}`, front: `P${n}`, back: 'R', topic, level, status, isDue,
})
const CARDS: Flashcard[] = [
  carta('Gota', 1, 'failed', true),
  carta('Gota', 1, 'learning', true),
  carta('Gota', 2, 'learning', false),
  carta('Gota', 2, 'new', true),
  carta('Condrocalcinosis', 1, 'new', true),
  carta('Condrocalcinosis', 3, 'new', true),
  carta(null, null, 'mastered', false),
  carta('  ', null, 'new', true),
]
const con = (p: Partial<AjustesSesion>): AjustesSesion => ({ ...AJUSTES_POR_DEFECTO, cantidad: null, ...p })

test('qué tarjetas: las mismas definiciones que el servidor', () => {
  assert.equal(coincideSolo(CARDS[0], 'failed'), true)
  assert.equal(coincideSolo(CARDS[0], 'due'), true, 'una fallada también está pendiente')
  assert.equal(coincideSolo(CARDS[1], 'due'), true)
  assert.equal(coincideSolo(CARDS[2], 'due'), false, 'vista pero aún no toca')
  assert.equal(coincideSolo(CARDS[3], 'due'), false, 'una nueva no es pendiente de repaso')
  assert.equal(coincideSolo(CARDS[3], 'new'), true)
  assert.equal(coinciden(CARDS, con({ solo: 'failed' })).length, 1)
  assert.equal(coinciden(CARDS, con({ solo: 'due' })).length, 2)
  assert.equal(coinciden(CARDS, con({ solo: 'new' })).length, 4)
})

test('temas: con su número, «sin tema» al final (vacío o en blanco cuentan igual)', () => {
  assert.deepEqual(temasDelGrupo(CARDS), [{ tema: 'Condrocalcinosis', total: 2 }, { tema: 'Gota', total: 4 }, { tema: '', total: 2 }])
  assert.equal(coinciden(CARDS, con({ temas: ['Gota'] })).length, 4)
  assert.equal(coinciden(CARDS, con({ temas: [''] })).length, 2)
})

test('dificultad: con filtro, las que no tienen nivel no entran; y se combina con lo demás', () => {
  assert.equal(coinciden(CARDS, con({ niveles: [1] })).length, 3)
  assert.equal(coinciden(CARDS, con({ niveles: [1], solo: 'new', temas: ['Condrocalcinosis'] })).length, 1)
})

test('escalera: las nuevas de un nivel cerrado no cuentan (con la foto del servidor)', () => {
  const escalera: Escalera = {
    topics: [{ topic: 'Condrocalcinosis', levels: [
      { level: 1, total: 1, mastered: 0, lowerTotal: 0, lowerMastered: 0, needed: 0, unlocked: true },
      { level: 3, total: 1, mastered: 0, lowerTotal: 1, lowerMastered: 0, needed: 1, unlocked: false },
    ] }],
  }
  assert.equal(coinciden(CARDS, con({ temas: ['Condrocalcinosis'] }), escalera).length, 1)
  assert.equal(coinciden(CARDS, con({ temas: ['Condrocalcinosis'], escalera: false }), escalera).length, 2)
})

test('paraEmpezar: solo los filtros que filtran algo, y el tope de servidas', () => {
  const todo = paraEmpezar(con({}), CARDS, true)
  assert.deepEqual(todo.opciones, { ladder: true })
  assert.equal(todo.limit, 20, 'mínimo 20')
  const r = paraEmpezar(con({ cantidad: 10, solo: 'failed', temas: ['Gota'], niveles: [1, 2], escalera: false }), CARDS, true)
  assert.deepEqual(r.opciones, { levels: [1, 2], ladder: false, topics: ['Gota'], onlyStatus: 'failed', cardLimit: 10 })
  assert.deepEqual(paraEmpezar(con({ temas: ['Gota', 'Condrocalcinosis', ''] }), CARDS, true).opciones, { ladder: true }, 'todos los temas = sin filtro')
  assert.deepEqual(paraEmpezar(con({ niveles: [1] }), CARDS, false).opciones, { ladder: false }, 'sin tarjetas con nivel, ni niveles ni escalera')
  const muchas = Array.from({ length: 300 }, () => carta('X', null, 'new', true))
  assert.equal(paraEmpezar(con({}), muchas, false).limit, 200, 'máximo 200')
})

test('sanearAjustes: lo guardado en el navegador no se da por bueno', () => {
  assert.deepEqual(sanearAjustes(null), AJUSTES_POR_DEFECTO)
  assert.deepEqual(sanearAjustes({ cantidad: 7, solo: 'raro', temas: [3, 'Gota'], niveles: [9, 2], escalera: 'no' }), {
    cantidad: 20, solo: 'todas', temas: ['Gota'], niveles: [2], escalera: true,
  })
  assert.equal(sanearAjustes({ cantidad: null }).cantidad, null, 'todas')
  assert.equal(sanearAjustes({ escalera: false }).escalera, false)
  assert.equal(sanearAjustes({ temas: [] }).temas, null)
})
