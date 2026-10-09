// Resúmenes activos con IA (informe 82): varios borradores (uno por archivo, migración de la versión 1)
// y el guardado de la vista previa (casi duplicados, tope de «texto original» por documento, tandas por
// documento). Lo puro; lo de IndexedDB y la red se prueban en el navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  claveBorrador,
  DOCUMENTO_V1,
  MAX_BORRADORES,
  ordenarBorradores,
  sanearBorrador,
  sanearFuente,
  sanearParrafo,
  sobrantes,
  type FuenteFirmada,
  type ParrafoBorrador,
} from '@/lib/resumenes/borrador'
import { excesosLiteral, literalPorDocumento, seGuarda, TANDA, tandasDeGuardado } from '@/lib/resumenes/guardado'
import type { Parecido } from '@/lib/resumenes/api'

const H1 = 'a'.repeat(64)
const H2 = 'b'.repeat(64)
const ARCHIVO = 'c'.repeat(64)
const F1: FuenteFirmada = { hash: H1, caracteres: 4000, firma: 'd'.repeat(64) }
const F2: FuenteFirmada = { hash: H2, caracteres: 1000, firma: 'e'.repeat(64) }
const T = 'La causa más frecuente es la tiroiditis de Hashimoto, con anticuerpos anti-TPO.'
const hueco = { i: T.indexOf('tiroiditis'), f: T.indexOf('tiroiditis') + 'tiroiditis de Hashimoto'.length, n: 1 as const }

const registro = (extra: Record<string, unknown> = {}) => ({
  clave: `u1:${ARCHIVO}`,
  usuario: 'u1',
  documento: ARCHIVO,
  titulo: 'Tiroides',
  modo: 'literal',
  fuente: { nombre: 't.pdf' },
  fuentes: [F1],
  lista: [{ key: 'p0', tema: 'Hipotiroidismo', texto: T, huecos: [hueco], incluir: true, doc: H1 }],
  fallidos: [],
  creado: 1,
  actualizado: 2,
  caduca: Date.now() + 86_400_000,
  ...extra,
})

test('claves: una por documento; sin documento, la de la versión 1', () => {
  assert.equal(claveBorrador('u1', ARCHIVO), `u1:${ARCHIVO}`)
  assert.equal(claveBorrador('u1'), `u1:${DOCUMENTO_V1}`)
})

test('sanearBorrador: documento, fuentes firmadas y el documento de cada párrafo', () => {
  const b = sanearBorrador(registro({ fuentes: [F1, { hash: 'x', caracteres: 3, firma: 'y' }, { ...F2, caracteres: 0 }] }))!
  assert.equal(b.documento, ARCHIVO)
  assert.deepEqual(b.fuentes, [F1], 'las fuentes mal formadas se quitan')
  assert.equal(b.lista[0].doc, H1)
  const p = sanearParrafo({ texto: T, huecos: [hueco], doc: 'nada', incluirParecido: 'sí' }, 'k')!
  assert.equal(p.doc, undefined)
  assert.equal(p.incluirParecido, undefined)
  assert.equal(sanearParrafo({ texto: T, huecos: [hueco], incluirParecido: true }, 'k')!.incluirParecido, true)
  assert.equal(sanearFuente({ ...F1, firma: 'z'.repeat(64) }), null)
})

test('migración: el borrador de la versión 1 (clave usuario:documento, sin fuentes) sigue valiendo', () => {
  const v1 = { clave: 'u1:documento', usuario: 'u1', titulo: 'Viejo', modo: 'resumen', fuente: {}, lista: registro().lista, fallidos: [], creado: 1, actualizado: 5, caduca: Date.now() + 1000 }
  const b = sanearBorrador(v1)!
  assert.equal(b.documento, DOCUMENTO_V1)
  assert.deepEqual(b.fuentes, [])
  assert.equal(b.lista.length, 1)
  // Un registro de la versión 2 sin el campo, por su clave.
  assert.equal(sanearBorrador({ ...registro(), documento: undefined })!.documento, ARCHIVO)
})

test('ordenarBorradores: del más reciente al más viejo; caducados, rotos y ajenos fuera', () => {
  const ahora = Date.now()
  const { vivos, sobran } = ordenarBorradores(
    [
      registro({ clave: 'u1:documento', documento: undefined, actualizado: 1 }),
      registro({ actualizado: 9 }),
      registro({ clave: `u1:${H2}`, documento: H2, actualizado: 5, caduca: ahora - 1 }),
      registro({ clave: `u1:${H1}`, documento: H1, lista: [] }),
      registro({ clave: `u2:${H1}`, usuario: 'u2' }),
    ],
    'u1',
    ahora,
  )
  assert.deepEqual(vivos.map((b) => b.clave), [`u1:${ARCHIVO}`, 'u1:documento'])
  assert.deepEqual(sobran.sort(), [`u1:${H1}`, `u1:${H2}`].sort(), 'el caducado y el roto se borran; el de otro usuario no se toca')
})

test('sobrantes: al guardar uno nuevo se van los más viejos que pasan del máximo', () => {
  const vivos = Array.from({ length: MAX_BORRADORES + 2 }, (_, k) => ({ clave: `u1:${k}`, actualizado: k }))
  const fuera = sobrantes(vivos, 'u1:nuevo')
  assert.equal(fuera.length, 3)
  assert.deepEqual(fuera, ['u1:2', 'u1:1', 'u1:0'])
  assert.deepEqual(sobrantes(vivos.slice(0, 3), 'u1:0'), [])
})

// ---------- guardado ----------

const P = (key: string, extra: Partial<ParrafoBorrador> = {}): ParrafoBorrador => ({ key, tema: 'Gota', texto: 'x'.repeat(100), huecos: [{ i: 0, f: 1, n: 1 }], incluir: true, doc: H1, ...extra })
const parecido: Parecido = { igual: false, tema: 'Gota', texto: 'otro' }

test('seGuarda: marcado y, si se parece a uno del grupo, solo con «Incluir igual»', () => {
  assert.equal(seGuarda(P('a'), null), true)
  assert.equal(seGuarda(P('a', { incluir: false }), null), false)
  assert.equal(seGuarda(P('a'), parecido), false)
  assert.equal(seGuarda(P('a', { incluirParecido: true }), parecido), true)
})

test('literal por documento y lo que se pasaría del 30 % en el grupo', () => {
  const lista = [P('a'), P('b', { texto: 'y'.repeat(300) }), P('c', { doc: H2 }), P('d', { incluir: false }), P('e')]
  const parecidos = new Map<string, Parecido | null>([['e', parecido]])
  const n = literalPorDocumento(lista, 'literal', parecidos)
  assert.deepEqual([...n], [[H1, 400], [H2, 100]], 'sin los desmarcados ni los parecidos')
  assert.equal(literalPorDocumento(lista, 'resumen', parecidos).size, 0, 'en «resumen» no hay tope')
  const ex = excesosLiteral(n, [{ hash: H1, usado: 900, tope: 1200 }, { hash: H2, usado: 0, tope: 600 }])
  assert.deepEqual(ex, [{ hash: H1, usado: 900, tope: 1200, nuevos: 400, sobran: 100 }])
})

test('tandas: por documento con su fuente, de 40 en 40, y los «Incluir igual» por su índice en la tanda', () => {
  const lista = [
    ...Array.from({ length: TANDA + 2 }, (_, k) => P(`a${k}`)),
    P('b0', { doc: H2 }),
    P('b1', { doc: H2, incluirParecido: true }),
    P('b2', { doc: H2 }),
    P('sin', { doc: undefined }),
  ]
  const parecidos = new Map<string, Parecido | null>([['b1', parecido], ['b2', parecido]])
  const t = tandasDeGuardado(lista, (p) => ({ texto: p.key, huecos: p.huecos }), [F1, F2], parecidos)
  assert.deepEqual(t.map((x) => [x.fuente?.hash ?? null, x.parrafos.length, x.incluirParecidos]), [
    [H1, TANDA, []],
    [H1, 2, []],
    [H2, 2, [1]],
    [null, 1, []],
  ])
  assert.deepEqual(t[2].parrafos.map((p) => p.texto), ['b0', 'b1'], 'b2 se parece y no se ha pedido incluirlo')
})
