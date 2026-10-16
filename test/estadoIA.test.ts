// El `/estado` de la IA recordado (estadoIACache): pintura instantánea con lo guardado, un pedido a la
// vez, memoria de 60 s, y un fallo de red que NO esconde la IA (solo un «no» del servidor la quita).
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { IAError } from '@/lib/mapas/ia/types'
import {
  caducarEstadosIA,
  consultarEstadoIA,
  olvidarEstadosIA,
  suscribirEstadosIA,
  valorEstadoIA,
} from '@/lib/ia/estadoIACache'

const almacen = new Map<string, string>()
;(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => void almacen.set(k, v),
  },
}

const SI = { disponible: true, limites: { maxChars: 1 } }

beforeEach(() => {
  almacen.clear()
  olvidarEstadosIA()
})

test('lo pedido se guarda por usuario y la siguiente visita lo pinta antes de preguntar', async () => {
  assert.deepEqual(await consultarEstadoIA('mapas', 'u1', async () => SI), SI)
  olvidarEstadosIA() // otra visita: memoria vacía, navegador con lo guardado
  let avisos = 0
  const quitar = suscribirEstadosIA(() => avisos++)
  let soltar!: (v: typeof SI) => void
  const p = consultarEstadoIA('mapas', 'u1', () => new Promise<typeof SI>((r) => (soltar = r)))
  assert.deepEqual(valorEstadoIA('mapas'), SI, 'se pinta lo guardado sin esperar al servidor')
  assert.equal(avisos, 1)
  soltar(SI)
  await p
  assert.equal(avisos, 1, 'si el servidor dice lo mismo, no se vuelve a pintar')
  quitar()
})

test('lo guardado es de cada usuario', async () => {
  await consultarEstadoIA('mapas', 'u1', async () => SI)
  olvidarEstadosIA()
  void consultarEstadoIA('mapas', 'u2', () => new Promise(() => {}))
  assert.equal(valorEstadoIA('mapas'), null)
})

test('un solo pedido en vuelo y 60 s de memoria; fresco pregunta igual', async () => {
  let pedidos = 0
  const pedir = async () => {
    pedidos++
    return SI
  }
  await Promise.all([consultarEstadoIA('flashcards', 'u1', pedir), consultarEstadoIA('flashcards', 'u1', pedir)])
  await consultarEstadoIA('flashcards', 'u1', pedir)
  assert.equal(pedidos, 1)
  await consultarEstadoIA('flashcards', 'u1', pedir, { fresco: true })
  assert.equal(pedidos, 2)
  caducarEstadosIA()
  await consultarEstadoIA('flashcards', 'u1', pedir)
  assert.equal(pedidos, 3, 'tras una generación se vuelve a preguntar')
})

test('un fallo de red o del servidor no esconde la IA ni pisa lo guardado', async () => {
  await consultarEstadoIA('resumenes', 'u1', async () => SI)
  for (const err of [new IAError('No se pudo conectar con el servidor'), new IAError('Error', 502)]) {
    const v = await consultarEstadoIA('resumenes', 'u1', async () => {
      throw err
    }, { fresco: true })
    assert.deepEqual(v, SI)
  }
  olvidarEstadosIA()
  void consultarEstadoIA('resumenes', 'u1', () => new Promise(() => {}))
  assert.deepEqual(valorEstadoIA('resumenes'), SI)
})

test('un «no» del servidor (sin plan, sin permiso) sí la quita y se recuerda', async () => {
  await consultarEstadoIA('mapas', 'u1', async () => SI)
  const v = await consultarEstadoIA('mapas', 'u1', async () => {
    throw new IAError('Sin plan', 403, 'sin_plan')
  }, { fresco: true })
  assert.equal(v, null)
  assert.equal(valorEstadoIA('mapas'), null)
  olvidarEstadosIA()
  void consultarEstadoIA('mapas', 'u1', () => new Promise(() => {}))
  assert.equal(valorEstadoIA('mapas'), null, 'la siguiente visita no enseña un botón que no toca')
})

test('lo guardado de hace más de 7 días no se pinta', async () => {
  almacen.set('mirdaily.ia.estado.v1:mapas:u1', JSON.stringify({ t: Date.now() - 8 * 24 * 3600 * 1000, v: SI }))
  void consultarEstadoIA('mapas', 'u1', () => new Promise(() => {}))
  assert.equal(valorEstadoIA('mapas'), null)
})
