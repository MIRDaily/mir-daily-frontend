// Entrada de un mapa recién generado: oleadas por profundidad, de arriba abajo, con el total acotado.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { delaysEntrada, MAX_NIVEL, NIVEL_MS, REPARTO_MS } from '@/lib/mapas/entrada'

test('delaysEntrada: la raíz primero, cada nivel después del anterior y de arriba abajo', () => {
  const d = delaysEntrada([
    { id: 'r', padre: null, y: 0 },
    { id: 'b2', padre: 'r', y: 100 },
    { id: 'b1', padre: 'r', y: -100 },
    { id: 'h', padre: 'b1', y: -120 },
  ])
  assert.equal(d.get('r'), 0)
  assert.ok(d.get('b1')! >= NIVEL_MS && d.get('b1')! < d.get('b2')!)
  assert.ok(d.get('h')! >= 2 * NIVEL_MS)
})

test('delaysEntrada: un mapa enorme no tarda más (niveles y escalonado acotados)', () => {
  const nodos: { id: string; padre: string | null; y: number }[] = [{ id: 'n0', padre: null, y: 0 }]
  // Una cadena de 12 niveles y 1.000 hojas en el último.
  for (let k = 1; k <= 12; k++) nodos.push({ id: `n${k}`, padre: `n${k - 1}`, y: k })
  for (let k = 0; k < 1000; k++) nodos.push({ id: `h${k}`, padre: 'n12', y: k })
  const d = delaysEntrada(nodos)
  const max = Math.max(...d.values())
  assert.ok(max <= MAX_NIVEL * NIVEL_MS + REPARTO_MS, String(max))
})

test('delaysEntrada: un padre que no está y un ciclo no rompen nada', () => {
  const d = delaysEntrada([
    { id: 'a', padre: 'b', y: 0 },
    { id: 'b', padre: 'a', y: 1 },
    { id: 'c', padre: 'fantasma', y: 2 },
  ])
  assert.equal(d.size, 3)
  assert.equal(d.get('c'), d.get('c')) // número válido
  for (const v of d.values()) assert.ok(Number.isFinite(v))
})
