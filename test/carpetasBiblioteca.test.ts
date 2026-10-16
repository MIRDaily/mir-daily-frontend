// Biblioteca sobre las carpetas (src/lib/carpetas/biblioteca.ts): portada con todas las asignaturas,
// carpetas de una asignatura (solo con material), rutas, sugerencia del material sin clasificar con
// el catálogo REAL de producción y las URL de la maqueta que se redirigen. Más las guías de estudio,
// que pasan de colgar de la maqueta a colgar del catálogo.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { AsignaturaCatalogo } from '@/lib/carpetas/sugerir'
import {
  agruparPorTipo,
  ASIGNATURA_DE_SLUG,
  carpetaDeSegmento,
  carpetasDeAsignatura,
  cuentaDe,
  idDeSegmento,
  rutaCarpeta,
  rutasElemento,
  sugerenciaDe,
  tarjetasAsignaturas,
  textoCuenta,
  type ElementoMaterial,
  type Recuento,
} from '@/lib/carpetas/biblioteca'
import { ASIGNATURA_DE_GUIA, getStudyGuide, guiaDeAsignatura } from '@/lib/studyGuides/index'

const ARBOL = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'catalogo-2026-10-16.json'), 'utf8')) as AsignaturaCatalogo[]
const REUMA = ARBOL.find((a) => a.nombre === 'Reumatología')!
const LUPUS = REUMA.temas.find((t) => t.nombre === 'Lupus eritematoso sistémico')!
const VASC = REUMA.temas.find((t) => /vasculitis/i.test(t.nombre))!

const el = (p: Partial<ElementoMaterial> & Pick<ElementoMaterial, 'tipo' | 'id'>): ElementoMaterial => ({
  titulo: 'X',
  actualizado: null,
  carpeta: { subjectId: null, topicId: null },
  elementos: p.tipo === 'mapa' ? null : 3,
  ...p,
})

describe('portada', () => {
  it('salen TODAS las asignaturas visibles, con lo que el usuario tiene en cada una', () => {
    const recuento: Recuento = {
      total: 4,
      sinClasificar: { total: 1, mapas: 1, flashcards: 0, resumenes: 0 },
      asignaturas: [
        {
          id: REUMA.id,
          total: 3,
          mapas: 2,
          flashcards: 1,
          resumenes: 0,
          general: { total: 1, mapas: 0, flashcards: 1, resumenes: 0 },
          temas: [{ id: LUPUS.id, total: 2, mapas: 2, flashcards: 0, resumenes: 0 }],
        },
      ],
    }
    const t = tarjetasAsignaturas(ARBOL, recuento)
    assert.equal(t.length, ARBOL.length)
    const reuma = t.find((x) => x.asignatura.id === REUMA.id)!
    assert.deepEqual([reuma.cuenta.total, reuma.temasConMaterial, reuma.tieneGeneral], [3, 1, true])
    const otra = t.find((x) => x.asignatura.id !== REUMA.id)!
    assert.deepEqual([otra.cuenta.total, otra.temasConMaterial, otra.tieneGeneral], [0, 0, false])
    assert.equal(tarjetasAsignaturas(ARBOL, null).every((x) => x.cuenta.total === 0), true, 'sin recuento todavía')
  })

  it('textoCuenta en castellano', () => {
    assert.equal(textoCuenta({ total: 1, mapas: 1, flashcards: 0, resumenes: 0 }), '1 mapa')
    assert.equal(textoCuenta({ total: 6, mapas: 2, flashcards: 1, resumenes: 3 }), '2 mapas · 1 grupo de flashcards · 3 grupos de resúmenes')
    assert.equal(textoCuenta({ total: 0, mapas: 0, flashcards: 0, resumenes: 0 }), '')
  })
})

describe('carpetas de una asignatura', () => {
  it('General primero y solo los temas con material, en el orden del catálogo', () => {
    const elementos = [
      el({ tipo: 'mapa', id: 'a', carpeta: { subjectId: REUMA.id, topicId: VASC.id } }),
      el({ tipo: 'flashcards', id: 'b', carpeta: { subjectId: REUMA.id, topicId: null } }),
      el({ tipo: 'resumenes', id: 'c', carpeta: { subjectId: REUMA.id, topicId: LUPUS.id } }),
      el({ tipo: 'mapa', id: 'd', carpeta: { subjectId: REUMA.id, topicId: LUPUS.id } }),
      el({ tipo: 'mapa', id: 'e', carpeta: { subjectId: REUMA.id, topicId: 999999 } }),
      el({ tipo: 'mapa', id: 'f', carpeta: { subjectId: 2, topicId: null } }),
    ]
    const c = carpetasDeAsignatura(REUMA, elementos)
    const orden = REUMA.temas.map((t) => t.id)
    assert.equal(c[0].topicId, null)
    assert.deepEqual(c[0].elementos.map((e) => e.id), ['b', 'e'], 'un tema que ya no está en el catálogo cuenta como General')
    assert.deepEqual(c.slice(1).map((x) => x.topicId), [LUPUS.id, VASC.id].sort((x, y) => orden.indexOf(x) - orden.indexOf(y)))
    assert.equal(c.length, 3, 'los temas vacíos no salen; lo de otra asignatura, tampoco')
    assert.deepEqual(c.find((x) => x.topicId === LUPUS.id)!.cuenta, { total: 2, mapas: 1, flashcards: 0, resumenes: 1 })
  })

  it('sin General si no tiene nada', () => {
    const c = carpetasDeAsignatura(REUMA, [el({ tipo: 'mapa', id: 'a', carpeta: { subjectId: REUMA.id, topicId: LUPUS.id } })])
    assert.deepEqual(c.map((x) => x.nombre), ['Lupus eritematoso sistémico'])
  })

  it('segmentos de URL: «general», ids de tema de esa asignatura y nada más', () => {
    assert.equal(rutaCarpeta(3080, null), '/library/3080/general')
    assert.equal(rutaCarpeta(3080, LUPUS.id), `/library/3080/${LUPUS.id}`)
    assert.deepEqual(carpetaDeSegmento(REUMA, 'general'), { topicId: null, nombre: 'General' })
    assert.deepEqual(carpetaDeSegmento(REUMA, String(LUPUS.id)), { topicId: LUPUS.id, nombre: LUPUS.nombre })
    const ajeno = ARBOL.find((a) => a.id !== REUMA.id && a.temas.length)!.temas[0]
    assert.equal(carpetaDeSegmento(REUMA, String(ajeno.id)), undefined, 'un tema de otra asignatura no vale')
    assert.equal(carpetaDeSegmento(REUMA, 'lupus'), undefined)
  })
})

describe('abrir y estudiar', () => {
  it('cada tipo con las URL de su pantalla; sin tarjetas no se estudia', () => {
    assert.deepEqual(rutasElemento({ tipo: 'mapa', id: 'm', elementos: null }), { abrir: '/mapas/m', estudiar: null })
    assert.deepEqual(rutasElemento({ tipo: 'flashcards', id: 'f', elementos: 4 }), { abrir: '/flashcards/f', estudiar: '/flashcards/f?study=1' })
    assert.deepEqual(rutasElemento({ tipo: 'resumenes', id: 'r', elementos: 2 }), { abrir: '/resumenes/r', estudiar: '/resumenes/r?estudiar=1' })
    assert.equal(rutasElemento({ tipo: 'flashcards', id: 'f', elementos: 0 }).estudiar, null)
  })

  it('una selección mezclada se mueve por tipos', () => {
    assert.deepEqual(
      agruparPorTipo([
        { tipo: 'mapa', id: '1' },
        { tipo: 'resumenes', id: '2' },
        { tipo: 'mapa', id: '3' },
      ]),
      [
        ['mapa', ['1', '3']],
        ['resumenes', ['2']],
      ],
    )
    assert.equal(cuentaDe([el({ tipo: 'mapa', id: '1' }), el({ tipo: 'mapa', id: '2' })]).mapas, 2)
  })
})

describe('sugerencia de lo sin clasificar (catálogo real)', () => {
  it('por el título, como al crear', () => {
    const s = sugerenciaDe(ARBOL, el({ tipo: 'mapa', id: 'm', titulo: 'Tema 06 Lupus eritematoso sistemico', textos: { descripcion: null, etiquetas: [], fuentes: [] } }))
    assert.deepEqual(s, { subjectId: REUMA.id, topicId: LUPUS.id })
  })

  it('un grupo con título soso se decide por los temas de sus tarjetas y su documento', () => {
    const s = sugerenciaDe(
      ARBOL,
      el({ tipo: 'resumenes', id: 'r', titulo: 'Repaso del martes', textos: { descripcion: null, etiquetas: ['Lupus', 'Lupus eritematoso sistémico'], fuentes: ['Tema_06_Lupus.pdf'] } }),
    )
    assert.deepEqual(s, { subjectId: REUMA.id, topicId: LUPUS.id })
  })

  it('un grupo que mezcla temas de una asignatura va a su General (§10.1)', () => {
    const s = sugerenciaDe(
      ARBOL,
      el({ tipo: 'flashcards', id: 'f', titulo: 'Reumatología', textos: { descripcion: null, etiquetas: ['Lupus eritematoso sistémico', 'Vasculitis', 'Gota', 'Artritis reumatoide'], fuentes: [] } }),
    )
    assert.deepEqual(s, { subjectId: REUMA.id, topicId: null })
  })

  it('sin nada claro no se propone nada', () => {
    assert.equal(sugerenciaDe(ARBOL, el({ tipo: 'mapa', id: 'm', titulo: 'JIJI', textos: { descripcion: null, etiquetas: [], fuentes: [] } })), null)
    assert.equal(sugerenciaDe(ARBOL, el({ tipo: 'mapa', id: 'm', titulo: 'Mapa sin título' })), null)
  })
})

describe('URL de la maqueta y guías de estudio', () => {
  it('ids numéricos y nada más', () => {
    assert.equal(idDeSegmento('207'), 207)
    assert.equal(idDeSegmento('0'), null)
    assert.equal(idDeSegmento('cardiologia'), null)
    assert.equal(idDeSegmento('20.5'), null)
  })

  it('cada asignatura de la maqueta redirige a una que existe en el catálogo (o a la portada)', () => {
    const visibles = new Set([...ARBOL.map((a) => a.id), 4342, 4343, 4344]) // las 3 nuevas no estaban en el fixture
    for (const [slug, id] of Object.entries(ASIGNATURA_DE_SLUG)) {
      if (id === null) assert.equal(slug, 'repasos-mir')
      else assert.ok(visibles.has(id), `${slug} → ${id}`)
    }
    assert.equal(ASIGNATURA_DE_SLUG.cardiologia, 2)
    assert.equal(ASIGNATURA_DE_SLUG.farmacologia, 1224, 'Farmacología es un tema de Mosaico')
  })

  it('las tres guías cuelgan de su asignatura y conservan su clave de texto (los reportes la guardan)', () => {
    assert.equal(guiaDeAsignatura(3080)?.subjectId, 'reumatologia')
    assert.equal(guiaDeAsignatura(1478)?.subjectId, 'neurologia')
    assert.equal(guiaDeAsignatura(3)?.subjectId, 'cirugia-general')
    assert.equal(guiaDeAsignatura(2), null)
    for (const [clave, id] of Object.entries(ASIGNATURA_DE_GUIA)) {
      assert.equal(getStudyGuide(clave)?.subjectId, clave)
      assert.ok(ARBOL.some((a) => a.id === id), `${clave} → ${id} existe`)
      assert.equal(ASIGNATURA_DE_SLUG[clave], id, 'la URL vieja de la asignatura y la de la guía llevan al mismo sitio')
    }
    assert.equal(getStudyGuide('toString'), null, 'una clave rara no saca nada del prototipo')
  })
})
