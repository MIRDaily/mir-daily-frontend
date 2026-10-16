// Sugerencia de carpeta (src/lib/carpetas/sugerir.ts) contra el catálogo REAL de producción del
// 16/10/2026 (17 asignaturas visibles y 224 temas, ya con los nombres nuevos), con títulos como los que
// usan de verdad los alumnos.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  carpetaDeParte,
  nombreCarpeta,
  parecido,
  SIN_CLASIFICAR,
  sugerirCarpeta,
  textosDocumento,
  type AsignaturaCatalogo,
} from '@/lib/carpetas/sugerir'

const ARBOL = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'catalogo-2026-10-16.json'), 'utf8')) as AsignaturaCatalogo[]
const sugerir = (titulo: string, ...listas: string[][]) => sugerirCarpeta(ARBOL, textosDocumento(titulo, ...listas))
const nombre = (titulo: string, ...listas: string[][]) => nombreCarpeta(ARBOL, sugerir(titulo, ...listas).carpeta)

describe('sugerirCarpeta', () => {
  it('un título que es un tema va a ese tema, con confianza alta', () => {
    assert.equal(nombre('Tema 06 Lupus eritematoso sistemico'), 'Reumatología › Lupus eritematoso sistémico')
    assert.equal(sugerir('Tema 06 Lupus eritematoso sistemico').confianza, 'alta')
    assert.equal(nombre('Tema 09 Esclerosis sistemica'), 'Reumatología › Esclerosis sistémica')
    assert.equal(nombre('Insuficiencia cardiaca (ejemplo)'), 'Cardiología y Cirugía Cardiovascular › Insuficiencia cardiaca')
  })

  it('aguanta variantes de nombre (plurales, sin tildes, palabras de más)', () => {
    assert.equal(nombre('Artritis microcristalinas'), 'Reumatología › Artritis por microcristales')
    assert.equal(nombre('Enfermedad metabólica osea'), 'Reumatología › Enfermedades metabólicas óseas')
    assert.equal(nombre('apuntes asma bronquial'), 'Neumología y Cirugía Torácica › Asma')
  })

  it('un título sin sentido va a «Sin clasificar»', () => {
    for (const t of ['JIJI', 'caca', 'acaca', 'Mis apuntes']) {
      assert.deepEqual(sugerir(t).carpeta, SIN_CLASIFICAR, t)
      assert.equal(sugerir(t).confianza, 'baja', t)
    }
  })

  it('un documento de toda una asignatura va a su «General»', () => {
    const s = sugerir('Reumatología - repaso completo', ['Lupus eritematoso sistémico', 'Vasculitis', 'Artrosis', 'Síndrome de Sjögren', 'Artritis reumatoide'])
    assert.equal(nombreCarpeta(ARBOL, s.carpeta), 'Reumatología › General')
    assert.equal(s.confianza, 'media')
    // Los temas votados quedan como candidatos.
    assert.ok(s.candidatas.length > 0)
    assert.ok(s.candidatas.every((c) => c.subjectId === 3080))
  })

  it('las etiquetas de las tarjetas deciden cuando el título no dice nada', () => {
    const s = sugerir('JIJI', ['Nefritis lúpica', 'Lupus eritematoso sistémico', 'Lupus eritematoso sistémico', 'Anticuerpos antinucleares'])
    assert.equal(nombreCarpeta(ARBOL, s.carpeta), 'Reumatología › Lupus eritematoso sistémico')
  })

  it('Mosaico por su nombre corto', () => {
    assert.equal(nombre('Mosaico: repaso'), 'Mosaico › General')
    assert.equal(nombre('Geriatría'), 'Mosaico › Geriatría')
  })
})

describe('carpetaDeParte (mapas tema a tema, un grupo por tema)', () => {
  const reuma = { subjectId: 3080, topicId: null }
  it('dentro de la asignatura elegida, cada parte a su tema', () => {
    assert.equal(nombreCarpeta(ARBOL, carpetaDeParte(ARBOL, reuma, 'Tema 15. Vasculitis')), 'Reumatología › Vasculitis')
    assert.equal(nombreCarpeta(ARBOL, carpetaDeParte(ARBOL, reuma, 'Introducción y semiología')), 'Reumatología › Introducción')
  })
  it('si no se parece a ninguno, a la «General» elegida; un tema elegido manda; «Sin clasificar» se respeta', () => {
    assert.deepEqual(carpetaDeParte(ARBOL, reuma, 'Casos clínicos variados'), reuma)
    const lupus = { subjectId: 3080, topicId: ARBOL.find((a) => a.id === 3080)!.temas.find((t) => t.nombre.startsWith('Lupus'))!.id }
    assert.deepEqual(carpetaDeParte(ARBOL, lupus, 'Vasculitis'), lupus)
    assert.deepEqual(carpetaDeParte(ARBOL, SIN_CLASIFICAR, 'Vasculitis'), SIN_CLASIFICAR)
  })
})

describe('nombreCarpeta y parecido', () => {
  it('nombre largo y corto', () => {
    assert.equal(nombreCarpeta(ARBOL, { subjectId: 4, topicId: null }, { corto: true }), 'Traumatología › General')
    assert.equal(nombreCarpeta(ARBOL, SIN_CLASIFICAR), 'Sin clasificar')
  })
  it('parecido simétrico en lo básico', () => {
    assert.equal(parecido('Valvulopatías', 'valvulopatias'), 1)
    assert.ok(parecido('Asma', 'Insuficiencia cardiaca') < 0.2)
  })
})

describe('sugerirCarpeta: una etiqueta suelta no decide', () => {
  it('una entre muchas sin sentido → Sin clasificar', () => {
    const ruido = Array.from({ length: 49 }, (_, i) => `Tarjeta ${i} jiji`)
    const s = sugerirCarpeta(ARBOL, textosDocumento('JIJI', [...ruido, 'Asma']))
    assert.deepEqual(s.carpeta, SIN_CLASIFICAR)
  })
})
