// Resúmenes activos (web): la página de un grupo. Buscar, filtrar, ordenar, agrupar por tema, la
// selección por tema, el icono por defecto y los mensajes de las acciones en bloque.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FILTROS_VACIOS,
  ICONO_RESUMEN_POR_DEFECTO,
  agruparPorTema,
  alternarVarios,
  coincide,
  cuandoVence,
  estadoSeleccion,
  filtrarParrafos,
  hayFiltros,
  iconoGrupo,
  mensajeBloque,
  mensajeErrorBloque,
  normalizar,
  ordenarParrafos,
  rangosEn,
  terminosDe,
  tocaRepasar,
  type ParrafoFiltrable,
} from '@/lib/resumenes/grupo'
import type { Hueco } from '@/lib/resumenes/huecos'

const hueco = (texto: string, trozo: string, n: 1 | 2 | 3 | 4 = 1): Hueco => {
  const i = texto.indexOf(trozo)
  assert.ok(i >= 0, trozo)
  return { i, f: i + trozo.length, n }
}

const P = (itemId: number, tema: string | null, texto: string, huecos: [string, 1 | 2 | 3 | 4][], extra: Partial<ParrafoFiltrable> = {}): ParrafoFiltrable => ({
  itemId,
  tema,
  texto,
  huecos: huecos.map(([t, n]) => hueco(texto, t, n)),
  status: 'new',
  due: true,
  fallos: 0,
  ...extra,
})

const T1 = 'La tiroiditis de Hashimoto es la causa más frecuente de hipotiroidismo en España.'
const T2 = 'El tratamiento del hipotiroidismo es la levotiroxina a 1,6 µg/kg/día.'
const T3 = 'La enfermedad de Graves cursa con exoftalmos y bocio difuso.'
const T4 = 'El carbimazol puede producir agranulocitosis: vigilar la fiebre.'
const T5 = 'El síndrome de Cushing más frecuente es el iatrogénico.'

const lista: ParrafoFiltrable[] = [
  P(1, 'Hipotiroidismo', T1, [['Hashimoto', 1], ['hipotiroidismo', 2]], { status: 'mastered', due: false, nextDueAt: '2026-10-20T00:00:00Z' }),
  P(2, 'Hipertiroidismo', T3, [['Graves', 2], ['exoftalmos', 3]], { status: 'failed', due: true, nextDueAt: '2026-10-01T00:00:00Z', fallos: 4, huecosFallados: [1] }),
  P(3, 'Hipotiroidismo', T2, [['levotiroxina', 1]], { status: 'learning', due: true, nextDueAt: '2026-10-05T00:00:00Z', fallos: 4, huecosFallados: [0] }),
  P(4, 'Hipertiroidismo', T4, [['agranulocitosis', 4]], { status: 'learning', due: false, nextDueAt: '2026-10-12T00:00:00Z', fallos: 1 }),
  P(5, null, T5, [['iatrogénico', 3]]),
]

test('normalizar: sin tildes ni mayúsculas', () => {
  assert.equal(normalizar('Síndrome de CUSHING, iatrogénico — Ñandú'), 'sindrome de cushing, iatrogenico — nandu')
  assert.deepEqual(terminosDe('  Hipotiroidismo   ESPAÑA hipotiroidismo '), ['hipotiroidismo', 'espana'])
  assert.deepEqual(terminosDe('   '), [])
})

test('coincide: todas las palabras, en el texto o en el tema; con «Solo en huecos», solo en las respuestas', () => {
  const [p1, , p3] = lista
  assert.equal(coincide(p1, terminosDe('espana TIROIDITIS')), true)
  assert.equal(coincide(p1, terminosDe('tiroiditis graves')), false)
  // El tema cuenta («hipotiroidismo» está en el tema de p3 y en su texto; «tema» solo).
  assert.equal(coincide(p3, terminosDe('hipotiroidismo levotiroxina')), true)
  assert.equal(coincide({ ...p3, texto: 'Otro texto distinto sin nada que ver aquí.', huecos: [] }, terminosDe('hipotiroidismo')), true)
  // Solo en huecos: «España» está en el texto pero no en ningún hueco.
  assert.equal(coincide(p1, terminosDe('espana'), true), false)
  assert.equal(coincide(p1, terminosDe('hashimoto'), true), true)
  assert.equal(coincide(p1, terminosDe('hashimoto hipotiroidismo'), true), true)
  // Y el tema no cuenta en ese modo.
  assert.equal(coincide(p3, terminosDe('hipotiroidismo'), true), false)
  assert.equal(coincide(lista[4], terminosDe('IATROGENICO'), true), true)
  assert.equal(coincide(p1, []), true)
})

test('rangosEn: posiciones del texto ORIGINAL, unidas si se solapan', () => {
  const t = 'Síndrome de Cushing: el síndrome iatrogénico.'
  const r = rangosEn(t, terminosDe('sindrome iatrogenico'))
  assert.deepEqual(r.map((x) => t.slice(x.i, x.f)), ['Síndrome', 'síndrome', 'iatrogénico'])
  // Una tilde «descompuesta» (e + ´) ocupa dos caracteres en el original y uno al buscar.
  const d = 'Adénopatía'
  const rd = rangosEn(d, ['adenopatia'])
  assert.deepEqual(rd, [{ i: 0, f: d.length }])
  assert.deepEqual(rangosEn('anana', ['ana', 'nan']), [{ i: 0, f: 4 }])
  assert.deepEqual(rangosEn('nada', []), [])
})

test('filtrarParrafos: estado y nivel (cualquiera), toca repasar, huecos fallados y la búsqueda (todos)', () => {
  const ids = (f: Partial<typeof FILTROS_VACIOS>) => filtrarParrafos(lista, { ...FILTROS_VACIOS, ...f }).map((p) => p.itemId)
  assert.deepEqual(ids({}), [1, 2, 3, 4, 5])
  assert.deepEqual(ids({ estados: ['learning', 'failed'] }), [2, 3, 4])
  assert.deepEqual(ids({ estados: ['new'] }), [5])
  assert.deepEqual(ids({ niveles: [4] }), [4])
  assert.deepEqual(ids({ niveles: [1, 3] }), [1, 2, 3, 5])
  // «Toca repasar»: due y no nuevo (el 5 es nuevo y due: no cuenta).
  assert.deepEqual(ids({ tocaRepasar: true }), [2, 3])
  assert.deepEqual(ids({ conFallados: true }), [2, 3])
  assert.deepEqual(ids({ busqueda: 'hipotiroidismo' }), [1, 3])
  assert.deepEqual(ids({ busqueda: 'hipotiroidismo', soloHuecos: true }), [1])
  assert.deepEqual(ids({ busqueda: 'hipotiroidismo', estados: ['learning'] }), [3])
  assert.deepEqual(ids({ tocaRepasar: true, niveles: [3] }), [2])
  // Sin estado se trata como nuevo.
  const sinEstado = { ...lista[0], status: undefined }
  assert.equal(filtrarParrafos([sinEstado], { ...FILTROS_VACIOS, estados: ['new'] }).length, 1)
})

test('hayFiltros: «Solo en huecos» sin búsqueda no filtra', () => {
  assert.equal(hayFiltros(FILTROS_VACIOS), false)
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, soloHuecos: true }), false)
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, busqueda: '  ' }), false)
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, busqueda: 'x' }), true)
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, niveles: [2] }), true)
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, conFallados: true }), true)
})

test('agruparPorTema y orden «documento»: por tema en orden de aparición, dentro el de llegada', () => {
  const g = agruparPorTema(lista)
  assert.deepEqual(g.map(([t, l]) => [t, l.map((p) => p.itemId)]), [
    ['Hipotiroidismo', [1, 3]],
    ['Hipertiroidismo', [2, 4]],
    ['', [5]],
  ])
  // Los espacios del tema no crean otro grupo.
  assert.equal(agruparPorTema([{ tema: 'A ' }, { tema: ' A' }, { tema: null }, { tema: '  ' }]).length, 2)
  assert.deepEqual(ordenarParrafos(lista, 'documento').map((p) => p.itemId), [1, 3, 2, 4, 5])
})

test('orden «Más fallados»: fallos, luego huecos fallados, luego documento', () => {
  const extra = [...lista, P(6, 'Hipotiroidismo', 'Otro párrafo de hipotiroidismo con mucho texto.', [['mucho', 1]], { fallos: 4, huecosFallados: [0, 0] })]
  // 2, 3 y 6 tienen 4 fallos; el 6 tiene 2 huecos fallados; 3 va antes que 2 en el documento.
  assert.deepEqual(ordenarParrafos(extra, 'fallados').map((p) => p.itemId), [6, 3, 2, 4, 1, 5])
  // No toca la lista que llega.
  assert.deepEqual(extra.map((p) => p.itemId), [1, 2, 3, 4, 5, 6])
})

test('orden «Próximos a vencer»: los que tocan repasar primero, luego por fecha, los nuevos al final', () => {
  const extra = [
    ...lista,
    P(7, 'Hipotiroidismo', 'Un nuevo con fecha no debería contar como programado.', [['fecha', 1]], { nextDueAt: '2026-10-02T00:00:00Z' }),
    P(8, null, 'Uno aprendiendo sin fecha válida va con los de sin fecha.', [['fecha', 1]], { status: 'learning', due: false, nextDueAt: 'nunca' }),
  ]
  // Vencidos: 2 (01/10) y 3 (05/10). Programados: 4 (12/10), 1 (20/10). Sin fecha / nuevos: 7, 5, 8 en orden de documento.
  assert.deepEqual(ordenarParrafos(extra, 'vencer').map((p) => p.itemId), [2, 3, 4, 1, 7, 5, 8])
})

test('tocaRepasar y cuandoVence', () => {
  assert.equal(tocaRepasar(lista[1]), true)
  assert.equal(tocaRepasar(lista[4]), false)
  const ahora = new Date(2026, 9, 9, 10, 0).getTime()
  const en = (d: number, h = 12) => new Date(2026, 9, 9 + d, h, 0).toISOString()
  const prog = (nextDueAt: string) => ({ ...lista[0], nextDueAt })
  assert.equal(cuandoVence(lista[1], ahora), 'Toca repasar')
  assert.equal(cuandoVence(lista[4], ahora), null)
  assert.equal(cuandoVence(prog(en(0, 23)), ahora), 'Vence hoy')
  assert.equal(cuandoVence(prog(en(1, 1)), ahora), 'Vence mañana')
  assert.equal(cuandoVence(prog(en(5)), ahora), 'Vence en 5 días')
  assert.equal(cuandoVence({ ...lista[0], nextDueAt: null }, ahora), null)
})

test('selección por tema: estado de la casilla y alternar', () => {
  const s = new Set([1, 3])
  assert.equal(estadoSeleccion([1, 3], s), 'todos')
  assert.equal(estadoSeleccion([1, 2], s), 'algunos')
  assert.equal(estadoSeleccion([2, 4], s), 'ninguno')
  assert.deepEqual([...alternarVarios(s, [1, 2])].sort(), [1, 2, 3])
  assert.deepEqual([...alternarVarios(s, [1, 3])], [])
  assert.deepEqual([...alternarVarios(s, [])].sort(), [1, 3])
  // No toca el Set que llega.
  assert.deepEqual([...s], [1, 3])
})

test('iconoGrupo: el de la paleta o el de resúmenes por defecto', () => {
  assert.equal(ICONO_RESUMEN_POR_DEFECTO, 'menu_book')
  assert.equal(iconoGrupo('cardiology'), 'cardiology')
  assert.equal(iconoGrupo(null), 'menu_book')
  assert.equal(iconoGrupo('no_existe'), 'menu_book')
})

test('mensajes de las acciones en bloque', () => {
  assert.equal(mensajeBloque({ accion: 'copiar', copiados: 5, duplicados: 2, destino: { name: 'X' } }), '5 copiados a «X» · 2 ya estaban y no se han repetido')
  assert.equal(mensajeBloque({ accion: 'copiar', copiados: 1, duplicados: 0, destino: { name: 'X' } }), '1 copiado a «X»')
  assert.equal(mensajeBloque({ accion: 'mover', movidos: 3, duplicados: 1, destino: { name: 'Y' } }), '3 movidos a «Y» · 1 ya estaba allí y se queda aquí')
  assert.equal(mensajeBloque({ accion: 'borrar', borrados: 1 }), '1 párrafo borrado · quedan 24 horas en la papelera')
  assert.equal(mensajeBloque({ accion: 'tema', cambiados: 4, tema: 'Graves' }), '4 párrafos cambiados de tema a «Graves»')
  assert.equal(mensajeBloque({ accion: 'tema', cambiados: 2, tema: null }), '2 párrafos cambiados de tema a «Sin tema»')
  const lleno = Object.assign(new Error('El grupo «Y» no tiene sitio para todos'), { limite: true, caben: 3 })
  assert.equal(mensajeErrorBloque(lleno), 'El grupo «Y» no tiene sitio para todos · Solo caben 3 más')
  assert.equal(mensajeErrorBloque(Object.assign(new Error('Lleno'), { limite: true, caben: 0 })), 'Lleno · No cabe ninguno más')
  assert.equal(mensajeErrorBloque(Object.assign(new Error('Tope del 30 %'), { literal: true })), 'Tope del 30 %')
  assert.equal(mensajeErrorBloque('raro'), 'No se pudo completar la acción')
})
