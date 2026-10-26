// PR de prueba (tanda 0): un error de tipos y un test que fallan a propósito para comprobar que la CI
// se pone en rojo. NO FUSIONAR: el PR se cierra sin fusionar.
import assert from 'node:assert/strict'
import { test } from 'node:test'

const numero: number = 'esto no es un número'

test('falla a propósito', () => {
  assert.equal(numero, 3)
})
