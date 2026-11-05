// Botones para responder una flashcard (lib/flashcards/botones.ts, etapa B2 del plan de flashcards).
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOTONES_SEMAFORO, botonesDe, esNumBotones, repartoDe, teclaAGrado } from '@/lib/flashcards/botones'

test('el semáforo: tres botones con los textos acordados y los grados 1, 2 y 3', () => {
  assert.deepEqual(BOTONES_SEMAFORO.map((b) => [b.grade, b.label]), [
    [1, 'No me la sabía'],
    [2, 'Me costó'],
    [3, 'Me la sabía'],
  ])
  assert.equal(botonesDe(3), BOTONES_SEMAFORO)
  assert.deepEqual(botonesDe(4).map((b) => b.grade), [1, 2, 3, 4])
})

test('ningún botón depende solo del color: todos llevan texto e icono', () => {
  for (const b of [...botonesDe(3), ...botonesDe(4)]) {
    assert.ok(b.label.length > 1 && b.icon.length > 1, b.label)
  }
})

test('teclado: 1-3 con el semáforo (el 4 no hace nada), 1-4 con Anki', () => {
  assert.equal(teclaAGrado('1', 3), 1)
  assert.equal(teclaAGrado('3', 3), 3)
  assert.equal(teclaAGrado('4', 3), null)
  assert.equal(teclaAGrado('4', 4), 4)
  for (const k of ['0', '5', 'a', ' ', '1.5', '01']) assert.equal(teclaAGrado(k, 4), null, k)
})

test('resumen: un recuadro por botón, y el «Fácil» que hubiera se enseña para que cuadre el total', () => {
  assert.deepEqual(repartoDe({ 1: 2, 3: 5 }, 3).map((x) => [x.boton.grade, x.total]), [[1, 2], [2, 0], [3, 5]])
  assert.deepEqual(repartoDe({ 3: 1, 4: 2 }, 3).map((x) => [x.boton.grade, x.total]), [[1, 0], [2, 0], [3, 1], [4, 2]])
  assert.equal(repartoDe({}, 4).length, 4)
})

test('solo 3 o 4', () => {
  assert.equal(esNumBotones(3), true)
  assert.equal(esNumBotones(4), true)
  for (const v of [2, 5, '3', null, undefined]) assert.equal(esNumBotones(v), false)
})
