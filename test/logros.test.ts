// Los fallos del incidente de las subidas de nivel en cascada (21/09/2026).
//
//   npm test
//
// Gemelo de `mirdailyapp/v6/test/niveles_regresion_test.dart`: la web y la app
// implementan la MISMA especificación (está escrita en `src/lib/logros.ts`) y
// las dos tienen que fallar por lo mismo si alguien la rompe.
//
//   A2  cada recarga añadía su propio "Nivel N" a la cola.
//   A4  un 200 con el estado de un usuario recién nacido se guardaba como
//       referencia, y a la siguiente lectura buena se celebraba el salto entero.
//   A5  la referencia vivía en una clave global de localStorage, sin dueño y
//       sin borrarse al cerrar sesión: cambiar de cuenta en el mismo navegador
//       le celebraba a la nueva los logros de la anterior.
//   A8  los desafíos se recordaban solo por código, sin periodo.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { xpParaNivel } from '@/lib/levels'
import type { Challenge, ProgressResponse } from '@/services/progressService'
import {
  detectarLogros,
  fotoAnomala,
  fusionarSaltos,
  guardarPendientes,
  guardarReferencia,
  leerPendientes,
  leerReferencia,
  purgarSinDuenno,
  referenciaDe,
  type Logro,
  type Referencia,
} from '@/lib/logros'

/** localStorage de mentira: Node no trae uno y estas funciones lo usan. */
function montarLocalStorage() {
  const caja = new Map<string, string>()
  const falso = {
    getItem: (k: string) => caja.get(k) ?? null,
    setItem: (k: string, v: string) => void caja.set(k, String(v)),
    removeItem: (k: string) => void caja.delete(k),
    clear: () => caja.clear(),
    key: (i: number) => [...caja.keys()][i] ?? null,
    get length() {
      return caja.size
    },
  }
  ;(globalThis as { localStorage?: unknown }).localStorage = falso
  return caja
}

function desafio(code: string, periodKey: string, completed = true): Challenge {
  return {
    code,
    scope: 'daily',
    metric: 'daily_complete',
    title: 'Haz el Daily',
    description: '',
    progress: completed ? 1 : 0,
    target: 1,
    xpReward: 30,
    completed,
    sortOrder: 1,
    periodKey,
    meta: null,
  }
}

function respuesta({
  level = 1,
  xpTotal = 0,
  racha = 0,
  daily = [] as Challenge[],
}): ProgressResponse {
  return {
    progress: {
      level,
      xpTotal,
      xpIntoLevel: xpTotal - xpParaNivel(level),
      xpForNext: 200,
      maxLevel: 100,
      currentStreak: racha,
      longestStreak: racha,
      streakFreezes: 0,
      lastActiveDay: '2026-09-21',
      streakMultiplier: 1,
      xpToday: 0,
      xpTodayTotal: 0,
      dailyCap: 300,
    },
    daily,
    weekly: [],
  }
}

/** El cuerpo que devolvía `/api/progress` cuando se tragaba un error. */
const FALLBACK = respuesta({})

const ref = (nivel: number, xpTotal: number, hechos: string[] = []): Referencia => ({
  nivel,
  xpTotal,
  racha: 0,
  hechos,
})

let caja: Map<string, string>
beforeEach(() => {
  caja = montarLocalStorage()
})

// ---------------------------------------------------------------------------
// A5 . La referencia y la cola van bajo el id de su dueno
// ---------------------------------------------------------------------------
describe('A5 · referencia por usuario', () => {
  it('lo de una cuenta no se le lee a la otra', () => {
    guardarReferencia('ana', ref(12, 3918))
    guardarPendientes('ana', [
      { id: 'de-ana', tipo: 'desafio', titulo: 'Suyo', xp: 30, scope: 'daily' },
    ])

    assert.equal(leerReferencia('ana')?.nivel, 12)
    assert.equal(
      leerReferencia('bea'),
      null,
      'con una clave global, bea heredaba el nivel 12 de ana y no celebraba nada suyo',
    )
    assert.deepEqual(leerPendientes('bea'), [])
  })

  it('la clave lleva el id', () => {
    guardarReferencia('ana', ref(3, 400))
    assert.ok(
      [...caja.keys()].every((k) => k.includes('ana')),
      'sin el id en la clave no hay forma de separar dos cuentas',
    )
  })

  it('una referencia de la versión vieja se descarta, no se reinterpreta', () => {
    // La v1 guardaba los desafíos sin periodo: darla por buena celebraría de
    // golpe todos los del día.
    caja.set(
      'mirdaily.logros.referencia.ana',
      JSON.stringify({ nivel: 12, xpTotal: 3918, racha: 2, hechos: ['daily_done'] }),
    )
    assert.equal(leerReferencia('ana'), null)
  })

  it('las claves globales heredadas se purgan', () => {
    caja.set('mirdaily.logros.referencia', '{"nivel":12}')
    caja.set('mirdaily.logros.pendientes', '[]')
    purgarSinDuenno()
    assert.equal(caja.has('mirdaily.logros.referencia'), false)
    assert.equal(caja.has('mirdaily.logros.pendientes'), false)
  })
})

// ---------------------------------------------------------------------------
// A4 . Una foto anomala no se toma por buena
// ---------------------------------------------------------------------------
describe('A4 · fotos anómalas', () => {
  it('el fallback del servidor encima de un nivel 12 es anómalo', () => {
    assert.equal(fotoAnomala(ref(12, 3918), FALLBACK), true)
  })

  it('un usuario nuevo de verdad NO es anómalo', () => {
    assert.equal(fotoAnomala(null, FALLBACK), false, 'sin referencia no hay con qué comparar')
    assert.equal(fotoAnomala(ref(1, 0), FALLBACK), false)
  })

  it('perder la lista de desafíos también es anómalo', () => {
    const sinDesafios = respuesta({ level: 12, xpTotal: 3918 })
    assert.equal(fotoAnomala(ref(12, 3918, ['daily_done|2026-09-21']), sinDesafios), true)
  })

  it('una bajada REAL de nivel se enseña (pero no se celebra)', () => {
    // Pasó de verdad el 08/09/2026 al reconstruir el ledger de recuperaciones:
    // tres cuentas bajaron de nivel. Eso hay que pintarlo.
    const reconstruido = respuesta({ level: 11, xpTotal: 3200, daily: [desafio('d', 'p')] })
    assert.equal(fotoAnomala(ref(12, 3918, ['d|p']), reconstruido), false)
    assert.deepEqual(detectarLogros(ref(12, 3918, ['d|p']), reconstruido), [])
  })
})

// ---------------------------------------------------------------------------
// A2 . Los saltos se funden
// ---------------------------------------------------------------------------
describe('A2 · fusión de saltos', () => {
  it('tres recargas de una subida del 9 al 12 son UN aviso', () => {
    const cola: Logro[] = [
      { id: 'a', tipo: 'nivel', nivel: 10, color: '#1', xpAntes: xpParaNivel(9), xpDespues: xpParaNivel(10) },
      { id: 'b', tipo: 'nivel', nivel: 11, color: '#1', xpAntes: xpParaNivel(10), xpDespues: xpParaNivel(11) },
      { id: 'c', tipo: 'rango', nivel: 12, rango: 'Graduado', color: '#2', xpAntes: xpParaNivel(11), xpDespues: xpParaNivel(12) + 90 },
    ]

    const out = fusionarSaltos(cola)

    assert.equal(out.length, 1)
    const salto = out[0] as Extract<Logro, { tipo: 'rango' }>
    assert.equal(salto.id, 'a', 'cambiar el id remontaría el modal a mitad de animación')
    assert.equal(salto.tipo, 'rango', 'el tramo cruzó rango aunque solo lo hiciera un peldaño')
    assert.equal(salto.nivel, 12)
    assert.equal(salto.xpAntes, xpParaNivel(9), 'la barra arranca donde arrancó el tramo')
    assert.equal(salto.xpDespues, xpParaNivel(12) + 90)
  })

  it('los desafíos y las rachas no se tocan', () => {
    const cola: Logro[] = [
      { id: 'd1', tipo: 'desafio', titulo: 'Haz el Daily', xp: 30, scope: 'daily' },
      { id: 'n', tipo: 'nivel', nivel: 5, color: '#1', xpAntes: 100, xpDespues: 200 },
      { id: 'r', tipo: 'racha', dias: 7 },
      { id: 'd2', tipo: 'desafio', titulo: 'Sesión de fondo', xp: 25, scope: 'daily' },
    ]
    assert.equal(fusionarSaltos(cola).length, 4)
  })

  it('un xpAntes a cero no manda la barra al principio de la curva', () => {
    // El campo se omite al serializar cuando vale 0, así que un logro
    // recuperado de localStorage puede llegar con cero: es "no se sabe".
    const cola: Logro[] = [
      { id: 'a', tipo: 'nivel', nivel: 11, color: '#1', xpAntes: 0, xpDespues: xpParaNivel(11) },
      { id: 'b', tipo: 'nivel', nivel: 12, color: '#1', xpAntes: xpParaNivel(11), xpDespues: xpParaNivel(12) },
    ]
    const salto = fusionarSaltos(cola)[0] as Extract<Logro, { tipo: 'nivel' }>
    assert.equal(salto.xpAntes, xpParaNivel(11))
  })
})

// ---------------------------------------------------------------------------
// A8 . Los desafios se recuerdan por codigo Y periodo
// ---------------------------------------------------------------------------
describe('A8 · desafíos por código y periodo', () => {
  it('el mismo desafío de otro día se vuelve a celebrar', () => {
    const ayer = ref(12, 3918, ['daily_done|2026-09-20'])
    const hoy = respuesta({ level: 12, xpTotal: 3918, daily: [desafio('daily_done', '2026-09-21')] })

    const logros = detectarLogros(ayer, hoy)

    assert.equal(logros.length, 1, 'hacer el Daily hoy es un logro de hoy, no el de ayer')
    assert.equal(logros[0].tipo, 'desafio')
  })

  it('el mismo desafío del MISMO día no se repite', () => {
    const hoy = ref(12, 3918, ['daily_done|2026-09-21'])
    const mismo = respuesta({ level: 12, xpTotal: 3918, daily: [desafio('daily_done', '2026-09-21')] })
    assert.deepEqual(detectarLogros(hoy, mismo), [])
  })

  it('la referencia guarda el periodo, no solo el código', () => {
    const r = referenciaDe(
      respuesta({ level: 12, xpTotal: 3918, daily: [desafio('daily_done', '2026-09-21')] }),
    )
    assert.deepEqual(r.hechos, ['daily_done|2026-09-21'])
  })

  it('sin periodKey (backend viejo) se degrada, no revienta', () => {
    const sinPeriodo = { ...desafio('daily_done', ''), periodKey: undefined }
    const r = referenciaDe(respuesta({ level: 12, xpTotal: 3918, daily: [sinPeriodo] }))
    assert.deepEqual(r.hechos, ['daily_done|'])
  })
})
