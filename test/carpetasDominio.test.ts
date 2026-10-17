// Señal de dominio del material (src/lib/carpetas/dominio.ts, fase 3): el umbral de «bien llevado»
// (§10.5) en sus bordes, los textos y fechas, y que la señal se quede en la Biblioteca: ni en el Panel ni
// leyendo las analíticas de preguntas («juntos pero no revueltos»).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  dominioPorCarpeta,
  estadoDominio,
  haceCuanto,
  porcentaje,
  textoRecordarias,
  UMBRAL_BIEN_LLEVADO,
  type DominioCarpeta,
} from '@/lib/carpetas/dominio'

const carpeta = (p: Partial<DominioCarpeta>): DominioCarpeta => ({
  topicId: 10,
  elementos: 10,
  estudiados: 8,
  dominio: 0.85,
  cobertura: 0.8,
  ultimoRepaso: null,
  grupos: [],
  huecosDebiles: [],
  ...p,
})

describe('estadoDominio y el umbral de «bien llevado»', () => {
  it('el umbral es el de la especificación (≥ 80 % de dominio y ≥ 70 % de cobertura)', () => {
    assert.deepEqual(UMBRAL_BIEN_LLEVADO, { dominio: 0.8, cobertura: 0.7 })
  })

  it('justo en el umbral cuenta; por debajo de cualquiera de los dos, no', () => {
    assert.equal(estadoDominio(carpeta({ dominio: 0.8, cobertura: 0.7 })), 'bien')
    assert.equal(estadoDominio(carpeta({ dominio: 0.7999, cobertura: 0.9 })), 'en-marcha')
    assert.equal(estadoDominio(carpeta({ dominio: 0.95, cobertura: 0.6999 })), 'en-marcha', 'mucho dominio de poco material no es «bien llevado»')
  })

  it('sin elementos o sin datos no hay señal; con elementos sin estudiar, «sin estudiar»', () => {
    assert.equal(estadoDominio(undefined), 'vacio')
    assert.equal(estadoDominio(carpeta({ elementos: 0, dominio: null, cobertura: null })), 'vacio')
    assert.equal(estadoDominio(carpeta({ estudiados: 0, dominio: 0, cobertura: 0 })), 'sin-estudiar')
  })
})

describe('textos', () => {
  it('porcentajes enteros y acotados', () => {
    assert.equal(porcentaje(0.7234), 72)
    assert.equal(porcentaje(0.725), 73)
    assert.equal(porcentaje(1.2), 100)
    assert.equal(porcentaje(-0.1), 0)
    assert.equal(textoRecordarias(0.7234), 'recordarías hoy ~72 %')
  })

  it('haceCuanto en días de calendario', () => {
    const ahora = new Date(2026, 9, 17, 10, 0)
    assert.equal(haceCuanto(new Date(2026, 9, 17, 0, 5).toISOString(), ahora), 'hoy')
    assert.equal(haceCuanto(new Date(2026, 9, 16, 23, 50).toISOString(), ahora), 'ayer')
    assert.equal(haceCuanto(new Date(2026, 9, 12).toISOString(), ahora), 'hace 5 días')
    assert.equal(haceCuanto(new Date(2026, 8, 30).toISOString(), ahora), 'hace 2 semanas')
    assert.match(haceCuanto(new Date(2026, 5, 1).toISOString(), ahora)!, /jun/)
    assert.match(haceCuanto(new Date(2025, 5, 1).toISOString(), ahora)!, /2025/)
    assert.equal(haceCuanto(null, ahora), null)
    assert.equal(haceCuanto('no es fecha', ahora), null)
  })

  it('dominioPorCarpeta: «General» por su clave y los temas por su id', () => {
    const m = dominioPorCarpeta({ disponible: true, carpetas: [carpeta({ topicId: null, dominio: 0.5 }), carpeta({ topicId: 10 })] })
    assert.equal(m.get('general')?.dominio, 0.5)
    assert.equal(m.get(10)?.dominio, 0.85)
    assert.equal(dominioPorCarpeta(null).size, 0)
  })
})

describe('juntos pero no revueltos', () => {
  const raiz = path.join(import.meta.dirname, '..', 'src')
  const ficheros = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = path.join(dir, n)
      return statSync(p).isDirectory() ? ficheros(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
    })

  it('el Panel no enseña la señal del material', () => {
    const panel = [...ficheros(path.join(raiz, 'app', 'panel')), ...ficheros(path.join(raiz, 'components', 'panel'))]
    assert.ok(panel.length > 0)
    for (const f of panel) assert.ok(!/carpetas\/dominio|dominioUi|cargarDominio/.test(readFileSync(f, 'utf8')), f)
  })

  it('la señal no lee las analíticas de preguntas', () => {
    for (const f of [path.join(raiz, 'lib', 'carpetas', 'dominio.ts'), path.join(raiz, 'components', 'library', 'biblioteca', 'dominioUi.tsx')]) {
      assert.ok(!/analyticsService|user_responses|heatmap/.test(readFileSync(f, 'utf8')), f)
    }
  })
})
