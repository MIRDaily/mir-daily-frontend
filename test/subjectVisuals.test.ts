import { readFileSync } from 'node:fs'
import path from 'node:path'
// La lista de flashcards agrupa y colorea las asignaturas reconociéndolas por el
// nombre del mazo, así que un emparejamiento malo no da error: solo manda la
// asignatura a la sección equivocada, y eso pasa desapercibido.
//
//   npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { subjectKeyFor, weightForSubject, DEFAULT_WEIGHT } from '@/lib/simulacro/mirWeights'
import { subjectVisual } from '@/lib/subjectVisuals'

describe('subjectKeyFor', () => {
  it('no confunde urología con neurología', () => {
    // "urologia" es subcadena de "neurologia": el emparejador va palabra a
    // palabra justo por esto.
    assert.equal(subjectKeyFor('Urología'), 'urologia')
    assert.equal(subjectKeyFor('Neurología'), 'neurologia')
  })

  it('reconoce el nombre con tildes, en minúsculas y con cola', () => {
    assert.equal(subjectKeyFor('CARDIOLOGÍA'), 'cardiologia')
    assert.equal(subjectKeyFor('Digestivo y cirugía general'), 'digestivo')
    assert.equal(subjectKeyFor('Ginecología y Obstetricia'), 'ginecologia')
  })

  it('acepta abreviaturas y alias', () => {
    assert.equal(subjectKeyFor('Neumo'), 'neumologia')
    assert.equal(subjectKeyFor('ORL'), 'otorrinolaringologia')
    assert.equal(subjectKeyFor('Traumato'), 'traumatologia')
  })

  it('devuelve null para lo que no es una asignatura del MIR', () => {
    assert.equal(subjectKeyFor('Mis dudas sueltas'), null)
    assert.equal(subjectKeyFor(''), null)
  })

  it('weightForSubject sigue dando el peso de siempre', () => {
    assert.equal(weightForSubject('Digestivo'), 9.8)
    assert.equal(weightForSubject('Oftalmología'), 1.6)
    assert.equal(weightForSubject('Cajón desastre'), DEFAULT_WEIGHT)
  })
})

describe('subjectVisual', () => {
  it('clasifica en la categoría de la Biblioteca', () => {
    assert.equal(subjectVisual('Cardiología').category, 'MÉDICA')
    assert.equal(subjectVisual('Traumatología').category, 'QUIRÚRGICA')
    assert.equal(subjectVisual('Estadística').category, 'BÁSICA')
  })

  it('reconoce asignaturas de la Biblioteca que no tienen peso MIR propio', () => {
    // Farmacología existe en la Biblioteca pero no reparte preguntas, así que
    // no está en MIR_WEIGHTS. Aun así es una asignatura, no un cajón personal.
    assert.equal(subjectVisual('Farmacología').category, 'BÁSICA')
    assert.equal(subjectVisual('Bioética y legislación').category, 'BÁSICA')
    assert.equal(subjectVisual('Cirugía Plástica').category, 'QUIRÚRGICA')
    assert.equal(subjectVisual('Bioestadística').sigla, 'ES')
  })

  it('las asignaturas que empiezan por "Cirugía" se resuelven por su otra palabra', () => {
    assert.equal(subjectVisual('Cirugía General y Digestivo').sigla, 'DG')
    assert.equal(subjectVisual('Cirugía Ortopédica y Trauma').sigla, 'TR')
    assert.equal(subjectVisual('Cirugía Plástica').sigla, 'CP')
  })

  it('manda a PERSONAL el mazo que no es una asignatura', () => {
    const visual = subjectVisual('Fórmulas que se me olvidan')
    assert.equal(visual.category, 'PERSONAL')
    assert.equal(visual.key, null)
    // Sin asignatura reconocida, la sigla sale de las iniciales.
    assert.equal(visual.sigla, 'FQ')
  })

  it('la sigla de una sola palabra son sus dos primeras letras', () => {
    assert.equal(subjectVisual('Chuletas').sigla, 'CH')
  })

  it('el color y el icono elegidos a mano mandan sobre los de la asignatura', () => {
    const porDefecto = subjectVisual('Cardiología')
    assert.equal(porDefecto.icon, 'cardiology')

    const aMano = subjectVisual('Cardiología', 'teal', 'science')
    assert.equal(aMano.icon, 'science')
    assert.equal(aMano.color.key, 'teal')
    // La categoría no se toca: sigue siendo la asignatura que es.
    assert.equal(aMano.category, 'MÉDICA')
  })

  it('cada asignatura del MIR tiene sigla propia', () => {
    const nombres = [
      'Digestivo', 'Miscelánea', 'Cardiología', 'Infecciosas', 'Neurología',
      'Neumología', 'Endocrinología', 'Ginecología', 'Estadística', 'Reumatología',
      'Traumatología', 'Pediatría', 'Nefrología', 'Psiquiatría', 'Hematología',
      'Otorrinolaringología', 'Dermatología', 'Urología', 'Inmunología', 'Oftalmología',
    ]
    const siglas = nombres.map((n) => subjectVisual(n).sigla)
    assert.equal(new Set(siglas).size, nombres.length, `siglas repetidas en ${siglas.join(',')}`)
    // Ninguna debe haber caído en PERSONAL.
    nombres.forEach((n) => assert.notEqual(subjectVisual(n).category, 'PERSONAL', n))
  })
})

describe('nombres nuevos de las asignaturas (16/10/2026)', () => {
  it('Mosaico es la antigua Miscelánea: mismo peso en el simulacro y misma identidad visual', () => {
    assert.equal(subjectKeyFor('Mosaico'), 'miscelanea')
    assert.equal(weightForSubject('Mosaico'), weightForSubject('Miscelánea y Ciencias Básicas'))
    assert.notEqual(weightForSubject('Mosaico'), DEFAULT_WEIGHT)
    assert.equal(subjectVisual('Mosaico').sigla, subjectVisual('Miscelánea y Ciencias Básicas').sigla)
    assert.equal(subjectVisual('Mosaico').key, 'miscelanea')
  })

  it('los otros cuatro cambios de nombre se siguen reconociendo', () => {
    const pares: [string, string][] = [
      ['Estadística y Epidemiología', 'estadistica'],
      ['Neurología y Neurocirugía', 'neurologia'],
      ['Endocrinología', 'endocrinologia'],
      ['Traumatología y Cirugía Ortopédica', 'traumatologia'],
      ['Ginecología y Obstetricia', 'ginecologia'],
      ['Oftalmología', 'oftalmologia'],
      ['Inmunología', 'inmunologia'],
    ]
    for (const [nombre, clave] of pares) assert.equal(subjectKeyFor(nombre), clave, nombre)
  })
})

describe('siglas: las mismas que la base de datos (subjects.sigla, §3.2)', () => {
  const { asignaturas } = JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', 'siglas-2026-10-17.json'), 'utf8'),
  ) as { asignaturas: { nombre: string; sigla: string }[] }

  it('cada asignatura visible, por su nombre completo, enseña su sigla de la base de datos', () => {
    assert.equal(asignaturas.length, 20)
    for (const { nombre, sigla } of asignaturas) {
      const v = subjectVisual(nombre)
      assert.notEqual(v.key, null, `${nombre} se reconoce como asignatura`)
      assert.equal(v.sigla, sigla, nombre)
    }
  })

  it('las que no son asignaturas del catálogo (Farmacología, Bioética, Cirugía Plástica) no chocan con ninguna', () => {
    const deLaBase = new Set(asignaturas.map((a) => a.sigla))
    for (const n of ['Farmacología', 'Bioética', 'Cirugía Plástica']) assert.ok(!deLaBase.has(subjectVisual(n).sigla), n)
  })

  it('los alias siguen reconociendo por nombre (Mosaico → miscelanea, Bioestadística → estadística)', () => {
    assert.equal(subjectVisual('Mosaico').key, 'miscelanea')
    assert.equal(subjectVisual('Mosaico').sigla, 'MO')
    assert.equal(subjectVisual('Miscelánea y Ciencias Básicas').sigla, 'MO')
    assert.equal(subjectVisual('Bioestadística').key, 'estadistica')
  })
})
