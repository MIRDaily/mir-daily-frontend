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
  itemId: ++n, flashcardId: `f${n}`, front: `P${n}`, back: 'R', topic, level, status, isDue, totalReviews: 0,
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

test('por defecto, «Lo de hoy» (etapa B3)', () => {
  assert.equal(AJUSTES_POR_DEFECTO.solo, 'hoy')
})

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
  // «Lo de hoy»: de Gota, la fallada, la que toca y la nueva (no la que aún no toca); sin tema, solo la nueva.
  assert.equal(coinciden(CARDS, con({ temas: ['Gota'] })).length, 3)
  assert.equal(coinciden(CARDS, con({ temas: [''] })).length, 1)
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

test('«Lo de hoy»: lo que toca y las nuevas hasta el cupo; «Repaso libre»: las ya vistas', () => {
  assert.equal(coinciden(CARDS, con({})).length, 6, 'sin dato del cupo, todas las nuevas')
  assert.equal(coinciden(CARDS, con({}), null, 2).length, 4, 'las 2 que tocan + 2 nuevas de 4')
  assert.equal(coinciden(CARDS, con({}), null, 0).length, 2, 'cupo agotado: solo lo que toca')
  assert.equal(coinciden(CARDS, con({ solo: 'libre' })).length, 4, 'las cuatro ya vistas, toquen o no')
  assert.equal(coinciden(CARDS, con({ solo: 'new' }), null, 0).length, 4, '«Solo nuevas» no tiene cupo')
  assert.equal(coincideSolo(CARDS[2], 'libre'), true, 'una que aún no toca entra en el repaso libre')
  assert.equal(coincideSolo(CARDS[3], 'libre'), false, 'una nueva no')
  assert.deepEqual(paraEmpezar(con({ solo: 'libre' }), CARDS, true).opciones, { ladder: true, practica: true })
  assert.equal(paraEmpezar(con({ cantidad: 10 }), CARDS, true, null, 1).limit, 20)
})

test('paraEmpezar: solo los filtros que filtran algo, y el tope de servidas', () => {
  const todo = paraEmpezar(con({}), CARDS, true)
  assert.deepEqual(todo.opciones, { ladder: true, onlyStatus: 'hoy' })
  assert.equal(todo.limit, 20, 'mínimo 20')
  const r = paraEmpezar(con({ cantidad: 10, solo: 'failed', temas: ['Gota'], niveles: [1, 2], escalera: false }), CARDS, true)
  assert.deepEqual(r.opciones, { levels: [1, 2], ladder: false, topics: ['Gota'], onlyStatus: 'failed', cardLimit: 10 })
  assert.deepEqual(paraEmpezar(con({ temas: ['Gota', 'Condrocalcinosis', ''] }), CARDS, true).opciones, { ladder: true, onlyStatus: 'hoy' }, 'todos los temas = sin filtro')
  assert.deepEqual(paraEmpezar(con({ niveles: [1] }), CARDS, false).opciones, { ladder: false, onlyStatus: 'hoy' }, 'sin tarjetas con nivel, ni niveles ni escalera')
  const muchas = Array.from({ length: 300 }, () => carta('X', null, 'new', true))
  assert.equal(paraEmpezar(con({}), muchas, false).limit, 200, 'máximo 200')
})

test('sanearAjustes: lo guardado en el navegador no se da por bueno', () => {
  assert.deepEqual(sanearAjustes(null), AJUSTES_POR_DEFECTO)
  assert.deepEqual(sanearAjustes({ cantidad: 7, solo: 'raro', temas: [3, 'Gota'], niveles: [9, 2], escalera: 'no' }), {
    cantidad: 20, solo: 'hoy', temas: ['Gota'], niveles: [2], escalera: true,
  })
  assert.equal(sanearAjustes({ solo: 'todas' }).solo, 'hoy', 'lo guardado antes de la etapa B3 pasa a «Lo de hoy»')
  assert.equal(sanearAjustes({ solo: 'libre' }).solo, 'libre')
  assert.equal(sanearAjustes({ cantidad: null }).cantidad, null, 'todas')
  assert.equal(sanearAjustes({ escalera: false }).escalera, false)
  assert.equal(sanearAjustes({ temas: [] }).temas, null)
})
