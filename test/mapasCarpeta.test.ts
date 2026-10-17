// La carpeta como única clasificación de los mapas (src/lib/mapas/carpetaMapa.ts): filtro por asignatura
// de la carpeta, «Sin clasificar», etiqueta de la tarjeta, y el mismo criterio que la Biblioteca para lo
// que no está en el árbol visible. Con el catálogo real de producción.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { AsignaturaCatalogo } from '@/lib/carpetas/sugerir'
import { asignaturaDeMapa, etiquetaCarpetaMapa, opcionesFiltroCarpeta, pasaFiltroCarpeta } from '@/lib/mapas/carpetaMapa'

const ARBOL = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'catalogo-2026-10-16.json'), 'utf8')) as AsignaturaCatalogo[]
const REUMA = ARBOL.find((a) => a.nombre === 'Reumatología')!
const LUPUS = REUMA.temas.find((t) => t.nombre === 'Lupus eritematoso sistémico')!
const CARDIO = ARBOL.find((a) => a.id === 2)!

const mapa = (subjectId: number | null, topicId: number | null = null) => ({ folder: { subjectId, topicId } })
const MAPAS = [mapa(REUMA.id, LUPUS.id), mapa(REUMA.id), mapa(CARDIO.id), mapa(null), mapa(null), mapa(1416, 99)]

describe('asignatura y etiqueta de un mapa', () => {
  it('tema, «General» y lo que no está en el árbol (oculta o desaparecida) como «Sin clasificar»', () => {
    assert.equal(etiquetaCarpetaMapa(mapa(REUMA.id, LUPUS.id), ARBOL)?.texto, 'Reumatología › Lupus eritematoso sistémico')
    assert.equal(etiquetaCarpetaMapa(mapa(REUMA.id), ARBOL)?.texto, 'Reumatología › General')
    assert.equal(etiquetaCarpetaMapa(mapa(REUMA.id, 999999), ARBOL)?.texto, 'Reumatología › General', 'tema que ya no es de ella')
    assert.equal(etiquetaCarpetaMapa(mapa(CARDIO.id), ARBOL)?.texto, 'Cardiología › General', 'con el nombre corto')
    assert.equal(etiquetaCarpetaMapa(mapa(null), ARBOL), null)
    assert.equal(asignaturaDeMapa(mapa(1416, 99), ARBOL), null, 'la asignatura de pruebas (oculta) no está en el árbol')
    assert.equal(asignaturaDeMapa({ folder: null }, ARBOL), null, 'base sin carpetas')
    assert.equal(asignaturaDeMapa(mapa(REUMA.id), null), null, 'árbol sin cargar')
  })
})

describe('filtro por carpeta', () => {
  it('opciones: Todas, Sin clasificar y las asignaturas con mapas, en el orden del catálogo, con sigla y cuenta', () => {
    const o = opcionesFiltroCarpeta(MAPAS, ARBOL)
    assert.deepEqual(o.map((x) => [x.valor, x.etiqueta, x.n]), [
      ['todas', 'Todas', 6],
      ['sin', 'Sin clasificar', 3],
      [CARDIO.id, 'Cardiología', 1],
      [REUMA.id, 'Reumatología', 2],
    ].sort((a, b) => (typeof a[0] === 'string' || typeof b[0] === 'string' ? 0 : ARBOL.findIndex((x) => x.id === a[0]) - ARBOL.findIndex((x) => x.id === b[0]))))
    assert.equal(o.find((x) => x.valor === REUMA.id)?.sigla, 'RM')
  })

  it('sin mapas sin clasificar no sale ese botón; el filtro elegido sale aunque se quede vacío', () => {
    const clasificados = [mapa(REUMA.id)]
    assert.ok(!opcionesFiltroCarpeta(clasificados, ARBOL).some((x) => x.valor === 'sin'))
    assert.ok(opcionesFiltroCarpeta(clasificados, ARBOL, 'sin').some((x) => x.valor === 'sin' && x.n === 0))
    assert.ok(opcionesFiltroCarpeta(clasificados, ARBOL, CARDIO.id).some((x) => x.valor === CARDIO.id && x.n === 0))
    assert.deepEqual(opcionesFiltroCarpeta(MAPAS, null), [], 'sin árbol no hay filtro')
  })

  it('pasaFiltroCarpeta: por asignatura (cualquier tema o General), «Sin clasificar» y todas', () => {
    assert.equal(MAPAS.filter((m) => pasaFiltroCarpeta(m, REUMA.id, ARBOL)).length, 2)
    assert.equal(MAPAS.filter((m) => pasaFiltroCarpeta(m, 'sin', ARBOL)).length, 3, 'incluye el de la asignatura oculta')
    assert.equal(MAPAS.filter((m) => pasaFiltroCarpeta(m, 'todas', ARBOL)).length, 6)
  })
})

describe('el texto libre `subject` ya no clasifica', () => {
  it('la página y la tarjeta de mapas no lo enseñan ni lo editan', () => {
    const raiz = path.join(import.meta.dirname, '..', 'src')
    const pagina = readFileSync(path.join(raiz, 'app', 'mapas', 'page.tsx'), 'utf8')
    const tarjeta = readFileSync(path.join(raiz, 'components', 'mapas', 'list', 'MapCard.tsx'), 'utf8')
    for (const [nombre, f] of [['page.tsx', pagina], ['MapCard.tsx', tarjeta]] as const) {
      assert.ok(!/setMapSubject|onSubject|map\.subject|m\.subject/.test(f), nombre)
    }
    assert.match(tarjeta, /Mover a carpeta…/)
  })
})
