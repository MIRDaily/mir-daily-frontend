// Resúmenes activos (web): lo puro. Huecos (las mismas reglas que el servidor), las operaciones de la
// vista previa (tocar una palabra, seleccionar un trozo, recolocar tras editar), el estudio (qué se
// tapa, el siguiente, la nota), el borrador (saneado de lo que viene de IndexedDB) y los ajustes de la
// sesión («Vas a estudiar N» y la petición).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ajustarSeleccion,
  ajustarTrasEditar,
  alternarPalabra,
  cambiarNivel,
  claveParrafo,
  crearHueco,
  empezarParrafo,
  errorHuecos,
  fallos,
  huecosTapados,
  notaDeRepaso,
  palabraEn,
  quitarHueco,
  responder,
  sanearHuecos,
  segmentos,
  siguienteTapado,
  terminado,
  type Hueco,
} from '@/lib/resumenes/huecos'
import { caducado, claveBorrador, sanearBorrador, sanearParrafo } from '@/lib/resumenes/borrador'
import { AJUSTES_POR_DEFECTO, aPeticion, cuantosSeEstudian, entra, sanearAjustes } from '@/lib/resumenes/sesion'

const T = 'La causa más frecuente es la tiroiditis de Hashimoto, con anticuerpos (anti-TPO). Dosis: 1,6 µg/kg/día.'
const h = (trozo: string, n: 1 | 2 | 3 | 4 = 1): Hueco => {
  const i = T.indexOf(trozo)
  return { i, f: i + trozo.length, n }
}
const tapado = (texto: string, hs: Hueco[]) => hs.map((x) => texto.slice(x.i, x.f))

test('errorHuecos: las reglas del servidor', () => {
  assert.equal(errorHuecos(T, [h('tiroiditis de Hashimoto')]), null)
  assert.match(errorHuecos(T, []) ?? '', /al menos/)
  assert.match(errorHuecos(T, [h('tiroiditis de Hashimoto'), { i: 35, f: 50, n: 2 }]) ?? '', /solapan/)
  assert.match(errorHuecos(T, [{ i: 0, f: 999, n: 1 }]) ?? '', /sale/)
  assert.match(errorHuecos(T, [{ i: 2, f: 3, n: 1 }]) ?? '', /no tiene texto/)
  assert.match(errorHuecos(T, Array.from({ length: 9 }, (_, k) => ({ i: k * 3, f: k * 3 + 2, n: 1 as const }))) ?? '', /8/)
})

test('sanearHuecos: solo los que valen, ordenados, sin solapes, como mucho 8', () => {
  const raw = [{ i: 60, f: 67, n: 2 }, h('tiroiditis de Hashimoto'), { i: 30, f: 40, n: 1 }, { i: 0, f: 999, n: 1 }, { i: 1, f: 2, n: 9 }, 'x', null]
  const r = sanearHuecos(raw, T)
  assert.deepEqual(r.map((x) => x.i), [T.indexOf('tiroiditis'), 60].sort((a, b) => a - b))
  assert.equal(sanearHuecos('nada', T).length, 0)
})

test('segmentos: texto y huecos alternados, con su índice', () => {
  const s = segmentos(T, [h('tiroiditis de Hashimoto', 1), h('anti-TPO', 2)])
  assert.equal(s.map((x) => x.t).join(''), T)
  assert.deepEqual(s.filter((x) => x.k !== undefined).map((x) => [x.t, x.k]), [['tiroiditis de Hashimoto', 0], ['anti-TPO', 1]])
})

test('palabraEn y ajustarSeleccion: palabras enteras sin la puntuación de los bordes', () => {
  const p = palabraEn(T, T.indexOf('TPO'))
  assert.equal(T.slice(p!.i, p!.f), 'anti-TPO')
  const q = palabraEn(T, T.indexOf('µg'))
  assert.equal(T.slice(q!.i, q!.f), 'µg/kg/día')
  assert.equal(palabraEn(T, 2), null, 'un espacio no es palabra')
  const a = ajustarSeleccion(T, T.indexOf('roiditis'), T.indexOf('Hashimoto') + 4)
  assert.equal(T.slice(a!.i, a!.f), 'tiroiditis de Hashimoto')
  assert.equal(ajustarSeleccion(T, 2, 3), null)
})

test('alternarPalabra: tocar una palabra la tapa; tocarla otra vez la destapa', () => {
  const pos = T.indexOf('Hashimoto') + 2
  const a = alternarPalabra(T, [], pos, 3)
  assert.deepEqual(tapado(T, a.huecos), ['Hashimoto'])
  assert.equal(a.huecos[0].n, 3)
  assert.deepEqual(alternarPalabra(T, a.huecos, pos, 3).huecos, [])
})

test('crearHueco: une los huecos que toca (con el nivel más alto) y no pasa de 8', () => {
  const base = [h('tiroiditis', 1), h('Hashimoto', 3)]
  const r = crearHueco(T, base, T.indexOf('tiroiditis'), T.indexOf('Hashimoto') + 9, 2)
  assert.deepEqual(tapado(T, r.huecos), ['tiroiditis de Hashimoto'])
  assert.equal(r.huecos[0].n, 3)
  const ocho = ['La', 'causa', 'más', 'frecuente', 'es', 'tiroiditis', 'Hashimoto', 'anticuerpos'].map((w) => h(w))
  assert.match(crearHueco(T, ocho, T.indexOf('Dosis'), T.indexOf('Dosis') + 5, 1).error ?? '', /8/)
})

test('cambiarNivel y quitarHueco', () => {
  const base = [h('tiroiditis', 1), h('Hashimoto', 3)]
  assert.deepEqual(cambiarNivel(base, 1, 4).map((x) => x.n), [1, 4])
  assert.deepEqual(tapado(T, quitarHueco(base, 0)), ['Hashimoto'])
})

test('ajustarTrasEditar: los huecos de lo que no cambia se mueven; los de lo cambiado se buscan o se pierden', () => {
  const base = [h('tiroiditis de Hashimoto', 1), h('anti-TPO', 2), h('1,6 µg/kg/día', 3)]
  const nuevo = T.replace('La causa más frecuente', 'La causa principal')
  const r = ajustarTrasEditar(T, nuevo, base)
  assert.equal(r.perdidos, 0)
  assert.deepEqual(tapado(nuevo, r.huecos), ['tiroiditis de Hashimoto', 'anti-TPO', '1,6 µg/kg/día'])
  const sinDosis = T.replace('1,6 µg/kg/día', '1,7 µg/kg/día')
  const r2 = ajustarTrasEditar(T, sinDosis, base)
  assert.equal(r2.perdidos, 1)
  assert.deepEqual(tapado(sinDosis, r2.huecos), ['tiroiditis de Hashimoto', 'anti-TPO'])
  // Un hueco cuyo trozo cambia de sitio pero sigue igual se encuentra.
  const movido = 'Anticuerpos (anti-TPO). ' + T
  const r3 = ajustarTrasEditar(T, movido, [h('Hashimoto', 2)])
  assert.deepEqual(tapado(movido, r3.huecos), ['Hashimoto'])
})

test('estudio: se tapan solo los niveles elegidos; el siguiente en orden; la nota sale de los fallos', () => {
  const hs = [h('tiroiditis de Hashimoto', 1), h('anti-TPO', 2), h('1,6 µg/kg/día', 4)]
  assert.deepEqual(huecosTapados(hs, [1, 4]), [0, 2])
  assert.deepEqual(huecosTapados(hs, null), [0, 1, 2])
  let e = empezarParrafo(hs, [1, 4])
  assert.equal(siguienteTapado(e), 0)
  e = responder(e, 0, 'sabia')
  assert.equal(siguienteTapado(e), 2)
  e = responder(e, 1, 'no')
  assert.equal(Object.keys(e.respuestas).length, 1, 'un hueco que no está tapado no se responde')
  assert.equal(terminado(e), false)
  e = responder(e, 2, 'no')
  assert.equal(terminado(e), true)
  assert.equal(fallos(e), 1)
  assert.deepEqual([notaDeRepaso(0), notaDeRepaso(1), notaDeRepaso(2), notaDeRepaso(5)], [3, 2, 1, 1])
})

test('claveParrafo: sin mayúsculas ni espacios de más', () => {
  assert.equal(claveParrafo('  La  ACG\n afecta '), 'la acg afecta')
})

test('borrador: clave por usuario, caducidad y saneado de lo que viene de IndexedDB', () => {
  assert.equal(claveBorrador('u1'), 'u1:documento')
  assert.equal(caducado({ caduca: Date.now() - 1 }), true)
  assert.equal(caducado({ caduca: Date.now() + 1000 }), false)
  assert.equal(caducado(null), true)
  const raw = {
    clave: 'u1:documento',
    usuario: 'u1',
    titulo: 'Vasculitis',
    modo: 'literal',
    fuente: { nombre: 'v.pdf', unidad: 'pagina', otra: 'x' },
    lista: [
      { key: 'a', tema: 'ACG', texto: T, huecos: [h('anti-TPO', 2), { i: -1, f: 3, n: 1 }], incluir: false, ia: { pagina: 3, dudoso: 'anclaje', malo: 1 } },
      { key: 'b', tema: 'ACG', texto: T, huecos: [] },
      'basura',
    ],
    fallidos: ['Tema 2: no salió', 7],
    creado: 1,
    actualizado: 2,
    caduca: 3,
  }
  const b = sanearBorrador(raw)!
  assert.equal(b.lista.length, 1, 'sin huecos válidos no hay párrafo')
  assert.deepEqual(b.lista[0].huecos, [h('anti-TPO', 2)])
  assert.equal(b.lista[0].incluir, false)
  assert.deepEqual(b.lista[0].ia, { pagina: 3, dudoso: 'anclaje' })
  assert.deepEqual(b.fuente, { nombre: 'v.pdf', unidad: 'pagina' })
  assert.equal(b.modo, 'literal')
  assert.deepEqual(b.fallidos, ['Tema 2: no salió'])
  assert.equal(sanearBorrador({ clave: 'x', usuario: 'u', lista: [] }), null)
  const p = sanearParrafo({ tema: '', texto: T, huecos: [h('anti-TPO', 2)] }, 'k0')!
  assert.equal(p.tema, 'General')
  assert.equal(p.key, 'k0')
})

test('sesión: «Vas a estudiar N» con las definiciones de la cola, y la petición', () => {
  const ps = [
    { tema: 'ACG', huecos: [h('anti-TPO', 1)], status: 'new', due: true },
    { tema: 'ACG', huecos: [h('anti-TPO', 4)], status: 'failed', due: true },
    { tema: 'Takayasu', huecos: [h('anti-TPO', 2)], status: 'learning', due: false },
    { tema: null, huecos: [h('anti-TPO', 2)], status: 'learning', due: true },
  ]
  const a = { ...AJUSTES_POR_DEFECTO }
  assert.equal(cuantosSeEstudian(ps, a), 4)
  assert.equal(cuantosSeEstudian(ps, { ...a, niveles: [4] }), 1)
  assert.equal(cuantosSeEstudian(ps, { ...a, temas: ['ACG'] }), 2)
  assert.equal(cuantosSeEstudian(ps, { ...a, temas: [''] }), 1, "'' = sin tema")
  assert.equal(cuantosSeEstudian(ps, { ...a, solo: 'new' }), 1)
  assert.equal(cuantosSeEstudian(ps, { ...a, solo: 'failed' }), 1)
  assert.equal(cuantosSeEstudian(ps, { ...a, solo: 'due' }), 2, 'pendiente = visto y fallado o vencido (lo nuevo no)')
  assert.equal(cuantosSeEstudian(ps, { ...a, cuantos: 3 }), 3)
  assert.equal(entra(ps[2], { ...a, solo: 'due' }), false)
  assert.deepEqual(aPeticion(a, ['ACG', 'Takayasu', '']), {})
  assert.deepEqual(aPeticion({ ...a, niveles: [3, 4], temas: ['ACG'], solo: 'due', cuantos: 10 }, ['ACG', 'Takayasu']), {
    levels: [3, 4], topics: ['ACG'], onlyStatus: 'due', cardLimit: 10,
  })
  assert.deepEqual(aPeticion({ ...a, temas: ['ACG', 'Takayasu'] }, ['ACG', 'Takayasu']), {}, 'todos los temas = sin filtro')
})

test('sesión: lo guardado en el navegador se sanea', () => {
  assert.deepEqual(sanearAjustes(null), AJUSTES_POR_DEFECTO)
  assert.deepEqual(sanearAjustes({ niveles: [4, 9, 4, 1], temas: ['ACG', 3], solo: 'raro', cuantos: 9999 }), { niveles: [1, 4], temas: ['ACG'], solo: 'todos', cuantos: null, escribir: false, anchoFijo: false })
})
