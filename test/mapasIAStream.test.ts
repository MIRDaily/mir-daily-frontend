// Streaming de «Crear con IA» (informe 76): eventos NDJSON no fiables, líneas partidas, árbol
// provisional, reinicios, corte antes del final y servidor antiguo (JSON de siempre).
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aplicarEvento,
  arbolProvisional,
  crearLectorLineas,
  leerEvento,
  leerRespuesta,
  MENSAJE_CORTADO,
  type EventoIA,
  type LineaProvisional,
} from '@/lib/mapas/ia/stream'
import { IAError } from '@/lib/mapas/ia/types'

test('leerEvento: solo eventos conocidos, con sus campos acotados', () => {
  assert.equal(leerEvento('no es json'), null)
  assert.equal(leerEvento('[1,2]'), null)
  assert.equal(leerEvento('{"tipo":"otro"}'), null)
  assert.equal(leerEvento('{"tipo":"fase","fase":"hackear"}'), null)
  assert.deepEqual(leerEvento('{"tipo":"fase","fase":"tablas"}'), { tipo: 'fase', fase: 'tablas' })
  assert.equal(leerEvento('{"tipo":"rama","parte":0,"d":0,"t":"x"}'), null)
  assert.equal(leerEvento('{"tipo":"rama","parte":0,"d":1.5,"t":"x"}'), null)
  assert.equal(leerEvento('{"tipo":"rama","parte":0,"d":1,"t":5}'), null)
  const largo = leerEvento(JSON.stringify({ tipo: 'rama', parte: 0, d: 2, t: 'a'.repeat(900), extra: '<img>' }))
  assert.deepEqual(largo, { tipo: 'rama', parte: 0, d: 2, t: 'a'.repeat(300) })
  assert.deepEqual(leerEvento('{"tipo":"error","error":"Sin cupo","codigo":"user_n","status":429}'), {
    tipo: 'error', error: 'Sin cupo', codigo: 'user_n', status: 429,
  })
  const fin = leerEvento('{"tipo":"fin","titulo":"T","doc":{"version":1,"nodes":[]}}')
  assert.equal(fin?.tipo, 'fin')
  assert.deepEqual(fin?.tipo === 'fin' && fin.datos, { titulo: 'T', doc: { version: 1, nodes: [] } })
})

test('crearLectorLineas: líneas partidas en cualquier sitio y la última sin salto', () => {
  const lineas: string[] = []
  const l = crearLectorLineas((x) => lineas.push(x))
  const texto = 'uno\ndos\ntres'
  for (const c of texto) l.push(c)
  l.fin()
  assert.deepEqual(lineas, ['uno', 'dos', 'tres'])
})

test('arbolProvisional: reconstruye como el servidor (sin saltos de nivel) y las partes en orden', () => {
  const lineas: LineaProvisional[] = [
    { parte: 1, d: 1, t: 'Segunda parte' },
    { parte: 0, d: 1, t: 'Bloque' },
    { parte: 0, d: 3, t: 'Salta a 3' },
    { parte: 0, d: 2, t: 'Hermano' },
    { parte: 0, d: 1, t: 'Otro bloque' },
  ]
  const arbol = arbolProvisional(lineas)
  assert.deepEqual(
    arbol.map((b) => [b.t, b.hijos.map((h) => h.t)]),
    [['Bloque', ['Salta a 3', 'Hermano']], ['Otro bloque', []], ['Segunda parte', []]],
  )
})

test('aplicarEvento: un reinicio borra solo las ramas de su parte', () => {
  let ls: LineaProvisional[] = []
  const ev: EventoIA[] = [
    { tipo: 'rama', parte: 0, d: 1, t: 'A' },
    { tipo: 'rama', parte: 1, d: 1, t: 'B' },
    { tipo: 'reinicio', parte: 0 },
    { tipo: 'rama', parte: 0, d: 1, t: 'A2' },
    { tipo: 'latido' },
  ]
  for (const e of ev) ls = aplicarEvento(ls, e)
  assert.deepEqual(ls.map((l) => l.t), ['B', 'A2'])
})

/** Respuesta con el cuerpo en trozos (como llega por la red). */
function respuesta(trozos: string[], tipo = 'application/x-ndjson; charset=utf-8', status = 200) {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const t of trozos) c.enqueue(enc.encode(t))
      c.close()
    },
  })
  return new Response(body, { status, headers: { 'Content-Type': tipo } })
}

test('leerRespuesta: pasa los eventos y devuelve el mapa del final', async () => {
  const todo =
    '{"tipo":"fase","fase":"leyendo"}\n{"tipo":"rama","parte":0,"d":1,"t":"Vasculitis"}\n' +
    '{"tipo":"latido"}\nbasura\n{"tipo":"fin","titulo":"T","doc":{"version":1,"nodes":[]},"generadoPorIA":true}\n'
  const trozos: string[] = []
  for (let i = 0; i < todo.length; i += 9) trozos.push(todo.slice(i, i + 9))
  const vistos: string[] = []
  const r = await leerRespuesta(respuesta(trozos), (e) => vistos.push(e.tipo))
  assert.deepEqual(vistos, ['fase', 'rama', 'latido'])
  assert.equal(r.titulo, 'T')
})

test('leerRespuesta: error a mitad → IAError con el mensaje del servidor', async () => {
  await assert.rejects(
    leerRespuesta(respuesta(['{"tipo":"fase","fase":"estructura"}\n{"tipo":"error","error":"La IA tardó demasiado","codigo":"timeout","status":504}\n']), () => {}),
    (e) => e instanceof IAError && e.message === 'La IA tardó demasiado' && e.status === 504 && e.codigo === 'timeout',
  )
})

test('leerRespuesta: si se corta antes del final, error claro y nada que guardar', async () => {
  await assert.rejects(
    leerRespuesta(respuesta(['{"tipo":"fase","fase":"estructura"}\n{"tipo":"rama","parte":0,"d":1,"t":"A"}\n']), () => {}),
    (e) => e instanceof IAError && e.message === MENSAJE_CORTADO && e.codigo === 'cortado',
  )
})

test('leerRespuesta: servidor antiguo (JSON) y error antes de empezar (429) se leen como siempre', async () => {
  const ok = await leerRespuesta(respuesta(['{"titulo":"Viejo","doc":{"version":1,"nodes":[]}}'], 'application/json'), () => {
    throw new Error('no hay eventos')
  })
  assert.equal(ok.titulo, 'Viejo')
  await assert.rejects(
    leerRespuesta(respuesta(['{"error":"Has llegado al máximo","motivo":"user_n"}'], 'application/json', 429), () => {}),
    (e) => e instanceof IAError && e.status === 429 && e.codigo === 'user_n',
  )
})
