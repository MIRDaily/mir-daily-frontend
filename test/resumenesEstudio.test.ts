// Resúmenes activos (web), el estudio al nivel de cada hueco: tapar solo los fallados, corregir dentro
// del párrafo, lo que se manda al servidor, el modo «Escribir la respuesta», «Solo huecos fallados» en
// los ajustes, «Repasar ahora» y «cuándo vuelve».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cambiarRespuesta,
  empezarParrafo,
  fallos,
  notaDeRepaso,
  reabrir,
  responder,
  resultados,
  sanearFallados,
  sanearFragmento,
  siguienteTapado,
  terminado,
  ultimoRespondido,
  type Hueco,
  type Nivel,
} from '@/lib/resumenes/huecos'
import { compararRespuesta, normalizarRespuesta, propuestaDe } from '@/lib/resumenes/escribir'
import { AJUSTES_POR_DEFECTO, aPeticion, cuandoVuelve, cuantosSeEstudian, entra, repasarAhora, sanearAjustes } from '@/lib/resumenes/sesion'

const T = 'La tiroiditis de Hashimoto da anti-TPO positivos y se trata con 1,6 µg/kg/día de levotiroxina.'
const h = (trozo: string, n: Nivel): Hueco => {
  const i = T.indexOf(trozo)
  return { i, f: i + trozo.length, n }
}
const HS = [h('Hashimoto', 1), h('anti-TPO', 2), h('1,6 µg/kg/día', 4), h('levotiroxina', 2)]

test('solo huecos fallados: se tapan solo los fallados de los niveles elegidos; si no queda ninguno, los de los niveles', () => {
  assert.deepEqual(empezarParrafo(HS, null, [1, 3]).tapados, [1, 3])
  assert.deepEqual(empezarParrafo(HS, [2], [0, 3]).tapados, [3], 'el 0 es de nivel 1: no se tapa')
  assert.deepEqual(empezarParrafo(HS, [4], [1]).tapados, [2], 'ninguno fallado de ese nivel: los del nivel')
  assert.deepEqual(empezarParrafo(HS, null, []).tapados, [0, 1, 2, 3], 'recuperados al repetirlo: todos')
  assert.deepEqual(empezarParrafo(HS, null).tapados, [0, 1, 2, 3], 'sesión normal')
})

test('corregir dentro del párrafo: tocar cambia la respuesta y la nota propuesta se recalcula; Retroceso reabre el último', () => {
  let e = empezarParrafo(HS, null)
  e = responder(e, 0, 'sabia')
  e = responder(e, 2, 'no')
  e = responder(e, 1, 'sabia')
  e = responder(e, 3, 'sabia')
  assert.equal(terminado(e), true)
  assert.equal(notaDeRepaso(fallos(e)), 2)
  e = cambiarRespuesta(e, 1)
  assert.equal(e.respuestas[1], 'no')
  assert.equal(notaDeRepaso(fallos(e)), 1, 'dos fallos: Otra vez')
  e = cambiarRespuesta(cambiarRespuesta(e, 1), 2)
  assert.equal(notaDeRepaso(fallos(e)), 3, 'todos bien: Bien')
  assert.equal(cambiarRespuesta(e, 7), e, 'un hueco sin contestar no cambia')
  // El último contestado es el 3 (aunque se haya corregido otro después).
  assert.equal(ultimoRespondido(e), 3)
  e = reabrir(e, 3)
  assert.equal(terminado(e), false)
  assert.equal(siguienteTapado(e), 3)
  assert.equal(ultimoRespondido(e), 1, 'el anterior en el orden en que se contestó')
  // Volver a contestar uno lo pone el último.
  e = responder(e, 0, 'no')
  assert.equal(ultimoRespondido(e), 0)
})

test('resultados: cada hueco tapado por su posición en el texto y si se sabía (los no tapados no van)', () => {
  let e = empezarParrafo(HS, [2, 4])
  e = responder(e, 1, 'sabia')
  e = responder(e, 2, 'no')
  e = responder(e, 3, 'sabia')
  e = responder(e, 0, 'no') // no está tapado: no cuenta
  assert.deepEqual(resultados(e, HS), [
    { i: HS[1].i, f: HS[1].f, sabia: true },
    { i: HS[2].i, f: HS[2].f, sabia: false },
    { i: HS[3].i, f: HS[3].f, sabia: true },
  ])
  assert.equal(fallos(e), 1)
})

test('escribir: se compara normalizando tildes, mayúsculas, espacios, «%», unidades y romanos', () => {
  const igual: [string, string][] = [
    ['levotiroxina', 'Levotiroxina'],
    ['  LEVOTIROXINA. ', 'levotiroxina'],
    ['tiroiditis de hashimoto', 'Tiroiditis de Hashimoto'],
    ['claudicacion mandibular', 'claudicación mandibular'],
    ['40%', '40 %'],
    ['40 por ciento', '40 %'],
    ['40', '40 %'],
    ['1,6 ug/kg/dia', '1,6 µg/kg/día'],
    ['1.6 mcg/kg/día', '1,6 µg/kg/día'],
    ['1,6', '1,6 µg/kg/día'],
    ['>5 mg/dl', '> 5 mg/dL'],
    ['>= 50 años', '≥50 años'],
    ['2', 'tipo II'],
    ['tipo 2', 'Tipo II'],
    ['la biopsia de arteria temporal', 'biopsia de arteria temporal'],
    ['anti TPO', 'anti-TPO'],
  ]
  for (const [e, c] of igual) assert.equal(compararRespuesta(e, c), 'igual', `${e} = ${c}`)
  const distinta: [string, string][] = [
    ['hipocalcemia', 'hipercalcemia'],
    ['IgM', 'IgA'],
    ['tipo 1', 'tipo II'],
    ['5', '> 5 mg/dl'],
    ['< 5', '> 5'],
    ['50', '60 años'],
    ['4', 'IgG4'],
    ['40 mg', '40 %'],
    ['metotrexato y leflunomida', 'metotrexato'],
  ]
  for (const [e, c] of distinta) assert.equal(compararRespuesta(e, c), 'distinta', `${e} ≠ ${c}`)
  assert.equal(compararRespuesta('metotrexate', 'metotrexato'), 'casi', 'una letra en palabra larga')
  assert.equal(compararRespuesta('anti-TPA', 'anti-TPO'), 'distinta', 'corta: sin tolerancia')
  assert.equal(compararRespuesta('   ', 'algo'), 'vacia')
  assert.deepEqual([propuestaDe('igual'), propuestaDe('casi'), propuestaDe('distinta'), propuestaDe('vacia')], ['sabia', 'sabia', 'no', 'no'])
  assert.equal(normalizarRespuesta('El Síndrome de Sjögren'), 'sindromedesjogren')
})

test('ajustes: «Solo huecos fallados» cuenta los párrafos con algún hueco fallado de los niveles elegidos y va a la petición', () => {
  const ps = [
    { tema: 'A', huecos: HS, status: 'learning', due: false, huecosFallados: [2] },
    { tema: 'A', huecos: HS, status: 'failed', due: true, huecosFallados: [] },
    { tema: 'B', huecos: HS, status: 'learning', due: false, huecosFallados: [0, 1] },
    { tema: 'B', huecos: HS, status: 'new' },
  ]
  const a = { ...AJUSTES_POR_DEFECTO, solo: 'huecos' as const }
  assert.equal(cuantosSeEstudian(ps, a), 2)
  assert.equal(cuantosSeEstudian(ps, { ...a, niveles: [4] }), 1, 'solo el que tiene fallado uno de nivel 4')
  assert.equal(cuantosSeEstudian(ps, { ...a, niveles: [3] }), 0)
  assert.equal(entra(ps[1], a), false, 'fallado como párrafo pero sin huecos fallados')
  assert.deepEqual(aPeticion(a, ['A', 'B']), { soloHuecosFallados: true })
  assert.deepEqual(aPeticion({ ...a, niveles: [2] }, ['A', 'B']), { levels: [2], soloHuecosFallados: true })
  // Escribir y ancho fijo no van al servidor.
  assert.deepEqual(aPeticion({ ...AJUSTES_POR_DEFECTO, escribir: true, anchoFijo: true }, ['A']), {})
  assert.deepEqual(sanearAjustes({ solo: 'huecos', escribir: true, anchoFijo: 'si' }), { ...AJUSTES_POR_DEFECTO, solo: 'huecos', escribir: true, anchoFijo: false })
})

test('repasar ahora: los mismos niveles, solo esos párrafos y solo sus huecos fallados', () => {
  assert.deepEqual(repasarAhora({ levels: [2, 3], topics: ['A'], onlyStatus: 'due', cardLimit: 10 }, [5, 3, 5]), { levels: [2, 3], soloHuecosFallados: true, itemIds: [5, 3] })
  assert.deepEqual(repasarAhora({}, [1]), { soloHuecosFallados: true, itemIds: [1] })
})

test('cuándo vuelve', () => {
  const ahora = new Date(2026, 9, 9, 12).getTime()
  assert.equal(cuandoVuelve(null, ahora), 'pendiente')
  assert.equal(cuandoVuelve(new Date(2026, 9, 9, 11).toISOString(), ahora), 'ya')
  assert.equal(cuandoVuelve(new Date(2026, 9, 9, 20).toISOString(), ahora), 'hoy')
  assert.equal(cuandoVuelve(new Date(2026, 9, 10, 8).toISOString(), ahora), 'mañana')
  assert.equal(cuandoVuelve(new Date(2026, 9, 13, 8).toISOString(), ahora), 'en 4 días')
  assert.match(cuandoVuelve(new Date(2026, 11, 25).toISOString(), ahora), /^el 25/)
})

test('lo que llega del servidor: fragmento de origen y huecos fallados saneados', () => {
  assert.deepEqual(sanearFallados([3, 1, 1, -2, 9, 'x', 2.5]), [1, 3])
  assert.equal(sanearFallados('1,2'), undefined)
  assert.equal(sanearFragmento('…la tiroiditis de Hashimoto…'), '…la tiroiditis de Hashimoto…')
  assert.equal(sanearFragmento(7), null)
  assert.equal(sanearFragmento('   '), null)
  assert.equal(sanearFragmento('x'.repeat(400))?.length, 300)
})
