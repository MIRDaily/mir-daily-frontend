// Resúmenes activos (web), informe 85: niveles accesibles (contraste AA, etiqueta corta, lo que lee
// un lector de pantalla), gestos con el dedo y la previsión y estadísticas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { NIVELES } from '@/lib/resumenes/huecos'
import { anuncioEstudio, contraste, estiloNivel, etiquetaHueco, GRIS_AA, NIVEL_CORTO, ROJO_KO, TINTA_NIVEL, VERDE_OK } from '@/lib/resumenes/accesible'
import { progresoDeslizar, respuestaDeslizar, seHaMovido, trozoEntre, umbralDeslizar } from '@/lib/resumenes/gestos'
import { diaCorto, porcentaje, sanearPrevision, textoAviso, tramosPrevision } from '@/lib/resumenes/prevision'

test('contraste: la fórmula de WCAG (blanco/negro 21, iguales 1)', () => {
  assert.equal(Math.round(contraste('#FFFFFF', '#000000')), 21)
  assert.equal(contraste('#3F7EA6', '#3F7EA6'), 1)
})

test('niveles: los tonos de siempre NO llegan a AA; la tinta de cada nivel sí (≥4,5 sobre su tono, blanco y la página)', () => {
  for (const n of NIVELES) {
    const { color, soft } = LEVEL_INFO[n]
    assert.ok(contraste(color, soft) < 4.5, `el tono ${n} ya llegaba (entonces sobra la tinta)`)
    for (const fondo of [soft, '#FFFFFF', '#FAF7F4']) {
      assert.ok(contraste(TINTA_NIVEL[n], fondo) >= 4.5, `tinta ${n} sobre ${fondo}: ${contraste(TINTA_NIVEL[n], fondo).toFixed(2)}`)
    }
  }
  for (const c of [VERDE_OK, ROJO_KO]) assert.ok(contraste('#FFFFFF', c) >= 4.5, `blanco sobre ${c}`)
  for (const fondo of ['#FFFFFF', '#FAF7F4']) assert.ok(contraste(GRIS_AA, fondo) >= 4.5, `gris sobre ${fondo}`)
})

test('niveles: etiqueta corta distinta para cada uno (además del color)', () => {
  const cortas = NIVELES.map((n) => NIVEL_CORTO[n])
  assert.equal(new Set(cortas).size, 4)
  assert.deepEqual(estiloNivel(3), { nombre: 'Difícil', corto: 'Dif', borde: LEVEL_INFO[3].color, suave: LEVEL_INFO[3].soft, tinta: TINTA_NIVEL[3] })
})

test('lector de pantalla: un hueco tapado nunca dice la respuesta; los demás dicen qué es y qué se puede hacer', () => {
  const tapado = etiquetaHueco('tapado', 2, 'colchicina')
  assert.ok(!tapado.includes('colchicina'))
  assert.match(tapado, /tapado, nivel media\. Toca para destaparlo/)
  assert.match(etiquetaHueco('tapado', 2, 'x', { escribir: true }), /escribir la respuesta/)
  assert.equal(etiquetaHueco('destapado', 1, 'gota'), 'Destapado: gota. ¿Lo sabías?')
  assert.match(etiquetaHueco('sabia', 1, 'gota'), /gota: lo sabías\. Toca para cambiarlo a «No lo sabía»/)
  assert.match(etiquetaHueco('no', 4, 'gota'), /no lo sabías\. Toca para cambiarlo a «Lo sabía»/)
  assert.match(etiquetaHueco('visible', 3, 'gota'), /no se tapa en esta sesión/)
  assert.equal(anuncioEstudio({ tipo: 'respondido', respuesta: 'gota', sabia: false, quedan: 2 }), 'gota: no lo sabías. Quedan 2 huecos.')
  assert.match(anuncioEstudio({ tipo: 'respondido', respuesta: 'gota', sabia: true, quedan: 0 }), /Párrafo terminado/)
  assert.equal(anuncioEstudio({ tipo: 'parrafo', tapados: 1, tema: 'Gota' }), 'Párrafo nuevo de Gota: 1 hueco tapado.')
})

test('gestos: deslizar a la derecha = Lo sabía, a la izquierda = No lo sabía; corto o vertical no cuenta', () => {
  assert.equal(umbralDeslizar(320), 70)
  assert.equal(umbralDeslizar(100), 64)
  assert.equal(umbralDeslizar(2000), 120)
  assert.equal(respuestaDeslizar(90, 10, 340), 'sabia')
  assert.equal(respuestaDeslizar(-90, 10, 340), 'no')
  assert.equal(respuestaDeslizar(40, 0, 340), null, 'corto')
  assert.equal(respuestaDeslizar(90, 80, 340), null, 'casi vertical: es desplazar la página')
  assert.equal(respuestaDeslizar(Number.NaN, 0, 340), null)
  assert.deepEqual(progresoDeslizar(37.5, 340), { hacia: 'sabia', fuerza: 0.5 })
  assert.deepEqual(progresoDeslizar(-500, 340), { hacia: 'no', fuerza: 1 })
  assert.deepEqual(progresoDeslizar(0, 340), { hacia: null, fuerza: 0 })
  assert.equal(seHaMovido(5, 5), false)
  assert.equal(seHaMovido(12, 0), true)
})

test('gestos: el trozo entre dos palabras tocadas, en cualquier orden', () => {
  assert.deepEqual(trozoEntre({ pos: 10, largo: 4 }, { pos: 30, largo: 6 }), { i: 10, f: 36 })
  assert.deepEqual(trozoEntre({ pos: 30, largo: 6 }, { pos: 10, largo: 4 }), { i: 10, f: 36 })
  assert.deepEqual(trozoEntre({ pos: 7, largo: 5 }, { pos: 7, largo: 5 }), { i: 7, f: 12 })
})

const DATO = {
  grupos: 2, parrafos: 12, nuevos: 3, pendientes: 7, repasoAhora: 4,
  prevision: { atrasados: 1, hoy: 5, manana: 2, semana: 8, mes: 9, dias: [{ fecha: '2026-10-10', n: 5 }, { fecha: '2026-10-11', n: 2 }] },
  estados: { new: 3, failed: 1, learning: 6, mastered: 2 },
  retencion: { repasos: 20, repasos30: 10, programados: 15, recordados: 12, tasa: 0.8, programados30: 8, recordados30: 6, tasa30: 0.75 },
  huecos: { repasados: 40, sabidos: 30, tasa: 0.75, repasados30: 20, sabidos30: 15, tasa30: 0.75 },
  masFallados: [{ itemId: 9, grupoId: 'g', grupo: 'Gota', tema: 'Gota', hueco: 1, texto: 'colchicina', nivel: 2, fallos: 3, intentos: 4, falladoAhora: true }],
  hoyFecha: '2026-10-10',
}

test('previsión: se queda tal cual si es buena; ceros y nulos si no', () => {
  assert.deepEqual(sanearPrevision(DATO), DATO)
  const v = sanearPrevision(undefined)
  assert.equal(v.pendientes, 0)
  assert.equal(v.retencion.tasa, null)
  assert.deepEqual(v.masFallados, [])
  const raro = sanearPrevision({ pendientes: -2, retencion: { tasa: 7 }, prevision: { dias: [{ fecha: 'mañana', n: 3 }, null] }, masFallados: [{ texto: '  ' }, { texto: 'x', nivel: 9 }] })
  assert.equal(raro.pendientes, 0)
  assert.equal(raro.retencion.tasa, 1)
  assert.deepEqual(raro.prevision.dias, [])
  assert.equal(raro.masFallados.length, 1)
  assert.equal(raro.masFallados[0].nivel, 2)
})

test('aviso: «Tienes N párrafos para repasar» con el desglose; nada si no hay nada', () => {
  assert.deepEqual(textoAviso(sanearPrevision(DATO)), {
    titulo: 'Tienes 7 párrafos para repasar',
    detalle: 'En tus resúmenes activos: 4 de repaso (1 de días anteriores) · 3 nuevos.',
  })
  assert.equal(
    textoAviso(sanearPrevision({ ...DATO, pendientes: 78, repasoAhora: 24, nuevos: 54, prevision: { ...DATO.prevision, atrasados: 24 } }))?.detalle,
    'En tus resúmenes activos: 24 de repaso (todos de días anteriores) · 54 nuevos.',
  )
  assert.equal(textoAviso(sanearPrevision({ ...DATO, pendientes: 1, repasoAhora: 0, nuevos: 1, prevision: { ...DATO.prevision, atrasados: 0 } }))?.titulo, 'Tienes 1 párrafo para repasar')
  assert.equal(textoAviso(sanearPrevision({ ...DATO, pendientes: 0 })), null)
  assert.match(textoAviso(sanearPrevision({ ...DATO, pendientes: 12345 }))!.titulo, /12\.345 párrafos/)
})

test('previsión: tramos, porcentajes y días', () => {
  const tr = tramosPrevision(sanearPrevision(DATO))
  assert.deepEqual(tr.map((x) => [x.etiqueta, x.n]), [['Hoy', 5], ['Mañana', 2], ['7 días', 8], ['30 días', 9]])
  assert.equal(tr[0].nota, '1 atrasados')
  assert.equal(porcentaje(0.756), '76 %')
  assert.equal(porcentaje(null), '—')
  assert.match(diaCorto('2026-10-12'), /12/)
})
