// Títulos de un PDF por su letra (src/lib/mapas/ia/extract/encabezados.ts) y su uso en el índice de
// «Qué parte usar» (construirIndice). Con tres temas reales de Reumatología de AMIR (fixtures con el texto
// del cuerpo enmascarado: solo se leen los títulos) y casos sintéticos.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { detectarEncabezados, type TrozoPdf } from '@/lib/mapas/ia/extract/encabezados'
import { construirIndice } from '@/lib/mapas/ia/indice'

function fixture(nombre: string): TrozoPdf[][] {
  const d = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'pdf-encabezados', `${nombre}.json`), 'utf8')) as {
    paginas: [string, number, string, number][][]
  }
  return d.paginas.map((p) => p.map(([str, alto, fuente, y]) => ({ str, alto, fuente, y })))
}
const lista = (e: ReturnType<typeof detectarEncabezados>) => e.map((x) => `${x.nivel === 2 ? '  ' : ''}${x.pagina}: ${x.titulo}`)

describe('detectarEncabezados con temas reales', () => {
  it('Esclerosis sistémica (un tema sin marcadores): los puntos cardinales, sin el título ni las cajas', () => {
    assert.deepEqual(lista(detectarEncabezados(fixture('Tema_09_Esclerosis_sistemica'))), [
      '1: Etiopatogenia',
      '1: Clasificación',
      '2: Cuadro clínico (MIR)',
      '3: Diagnóstico',
      '5: Evolución',
      '5: Tratamiento',
      '6: 9.1. Síndromes esclerodermiformes',
      '  6: Fascitis eosinofílica',
      '  6: Cuadros clínicos esclerodérmicos inducidos por sustancias químicas',
      '  6: Síndromes pseudoesclerodermiformes',
    ])
  })

  it('Lupus: los apartados numerados son el nivel 1 y lo que cuelga de ellos, el 2', () => {
    const e = detectarEncabezados(fixture('Tema_06_Lupus_eritematoso_sistemico'))
    assert.deepEqual(e.filter((x) => x.nivel === 1).map((x) => x.titulo), ['6.1. Lupus eritematoso sistémico', '6.2. Síndrome antifosfolípido (SAF)'])
    assert.deepEqual(e.slice(1, 5).map((x) => x.titulo), ['Concepto', 'Epidemiología', 'Etiopatogenia', 'Clínica'])
    assert.ok(e.every((x) => !/Tema 6|Regla mnemotécnica|ENFOQUE MIR/i.test(x.titulo)), 'ni el título del tema ni las cajas')
  })

  it('Vasculitis: un apartado que se repite («Diagnóstico» en cada enfermedad) sigue siendo un título, y los partidos en varias líneas se unen', () => {
    const e = detectarEncabezados(fixture('Tema_03_Vasculitis'))
    assert.equal(e.filter((x) => x.titulo === 'Diagnóstico').length, 6)
    assert.ok(e.some((x) => x.titulo === '3.2. Vasculitis asociadas a anticuerpos anticitoplasma de neutrófilo (ANCA)'))
    assert.ok(e.some((x) => x.titulo === '3.3. Arteritis de células gigantes, de la temporal o enfermedad de Horton'))
    assert.ok(e.some((x) => x.titulo === 'Granulomatosis con poliangeítis (granulomatosis de Wegener)'))
    assert.deepEqual(e.slice(0, 5).map((x) => [x.nivel, x.titulo]), [
      [1, 'Clasificación'],
      [1, 'Etiopatogenia (MIR 10, 213)'],
      [1, 'Diagnóstico'],
      [1, 'Sospecha diagnóstica (ver tabla 2)'],
      [1, 'Pruebas complementarias'],
    ], 'lo de antes del primer apartado numerado es nivel 1')
    assert.equal(e.filter((x) => /^3\.\d+\./.test(x.titulo)).length, 10)
  })
})

describe('detectarEncabezados: casos sintéticos', () => {
  const cuerpo = (n: number, y: number): TrozoPdf => ({ str: 'texto normal del cuerpo '.repeat(n), alto: 9, fuente: 'f5', y })
  const titulo = (str: string, y: number, alto = 11): TrozoPdf => ({ str, alto, fuente: 'f2', y })

  it('una cabecera repetida en la misma altura de cada página no es un título', () => {
    const paginas = [1, 2, 3, 4].map((p) => [titulo('Manual de Reumatología', 800), cuerpo(20, 700), ...(p === 2 ? [titulo('Diagnóstico', 500)] : []), ...(p === 3 ? [titulo('Tratamiento', 300)] : []), cuerpo(20, 200)])
    assert.deepEqual(detectarEncabezados(paginas).map((x) => x.titulo), ['Diagnóstico', 'Tratamiento'])
  })

  it('sin letra más grande que el cuerpo, nada; y con un solo tamaño de título en la portada, tampoco', () => {
    assert.deepEqual(detectarEncabezados([[cuerpo(30, 700), cuerpo(30, 600)]]), [])
    assert.deepEqual(detectarEncabezados([[titulo('Esclerosis sistémica', 750, 25), cuerpo(30, 600)], [cuerpo(30, 700)]]), [])
    assert.deepEqual(detectarEncabezados([]), [])
  })

  it('dos títulos seguidos pero separados (más de línea y media) no se unen', () => {
    const e = detectarEncabezados([[cuerpo(30, 760), titulo('6.1. Lupus', 700), titulo('Concepto', 670), cuerpo(30, 600), titulo('Clínica', 400), cuerpo(30, 300)]])
    assert.deepEqual(e.map((x) => [x.nivel, x.titulo]), [[1, '6.1. Lupus'], [2, 'Concepto'], [2, 'Clínica']])
  })
})

describe('el índice de «Qué parte usar» con los títulos', () => {
  // Seis páginas con texto que empieza a mitad de frase (como el PDF de la captura).
  const paginas = ['sión arterial pulmonar y la enfermedad…', 'forma generalizada). La gravedad…', 'de ANA, anticuerpos específicos…', 'y Ecocardiograma transtorácico…', 'más micofenolato, por su menor…', 'Tema 9 Esclerosis sistémica'].map(
    (t, i) => ({ texto: `${t}\n${'x'.repeat(300)}`, pagina: i + 1 }),
  )
  paginas.unshift(paginas.pop()!)
  paginas.forEach((p, i) => (p.pagina = i + 1))

  it('con títulos, las entradas son los apartados (no la primera línea de cada página)', () => {
    const enc = detectarEncabezados(fixture('Tema_09_Esclerosis_sistemica'))
    const ind = construirIndice(paginas, [], enc)
    assert.deepEqual(ind.map((e) => e.titulo).slice(0, 6), ['Etiopatogenia', 'Clasificación', 'Cuadro clínico (MIR)', 'Diagnóstico', 'Evolución', 'Tratamiento'])
    assert.ok(ind.every((e) => !/^(sión|forma generalizada|de ANA|y Ecocardiograma|más micofenolato)/.test(e.titulo)))
    // Cada apartado comparte la página en que empieza el siguiente: elegir «Cuadro clínico» no pierde su final.
    const cuadro = ind.find((e) => e.titulo === 'Cuadro clínico (MIR)')!
    assert.deepEqual([cuadro.paginaDesde, cuadro.paginaHasta], [2, 3])
    assert.equal(ind.find((e) => e.titulo === 'Fascitis eosinofílica')?.nivel, 2)
  })

  it('sin títulos, como antes: una entrada por página', () => {
    const ind = construirIndice(paginas, [], [])
    assert.equal(ind.length, 6)
  })

  it('los marcadores del PDF y un libro con varios «Tema N» siguen mandando sobre los títulos', () => {
    const enc = [{ titulo: 'Etiopatogenia', pagina: 1, nivel: 1 as const }, { titulo: 'Clínica', pagina: 2, nivel: 1 as const }]
    assert.deepEqual(construirIndice(paginas, [{ titulo: 'Uno', pagina: 1 }, { titulo: 'Dos', pagina: 4 }], enc).map((e) => e.titulo), ['Uno', 'Dos'])
    const libro = [1, 2, 3].map((n) => ({ texto: `Tema ${n}\nTítulo del tema ${n}\n${'x'.repeat(200)}`, pagina: n }))
    assert.deepEqual(construirIndice(libro, [], enc).map((e) => e.titulo), ['Tema 1. Título del tema 1', 'Tema 2. Título del tema 2', 'Tema 3. Título del tema 3'])
  })
})
