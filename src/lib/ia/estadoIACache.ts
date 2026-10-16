// El `/estado` de cada familia de IA (mapas, flashcards, resúmenes), compartido y recordado.
//
// Antes cada página lo pedía al montarse, DESPUÉS de cargar sus propios datos, y lo tiraba al salir:
// los botones de IA aparecían siempre un segundo tarde (navegador → Railway → Supabase, en serie) y
// cada visita volvía a pagar el viaje. Ahora:
//  - Lo último que se supo se guarda en este navegador (por usuario) y se pinta al instante; se vuelve
//    a preguntar por detrás y, si ha cambiado, se corrige (stale-while-revalidate).
//  - Un solo pedido en vuelo por familia, y lo pedido vale 60 s para todos (página, diálogos, editor,
//    Studio): el servidor recibe menos peticiones, no más.
//  - Un fallo de red o del servidor NO esconde la IA: se queda lo último que se supo. Solo un «no» del
//    servidor (401/403/404) la quita.
// Nada de esto es la protección: el servidor valida plan, saldo y permisos en cada generación. Si lo
// guardado está viejo, lo peor es un botón que sobra un segundo o un 403 con su mensaje.
//
// Este módulo es la parte pura (memoria, navegador, errores); estadoIA.ts le pone la sesión y el hook.

import { IAError } from '@/lib/mapas/ia/types'

export type FamiliaIA = 'mapas' | 'flashcards' | 'resumenes'

const VERSION = 1
/** Lo guardado en el navegador se pinta si tiene menos de esto (luego se pregunta igual). */
const VIGENCIA_GUARDADO = 7 * 24 * 60 * 60 * 1000
/** Lo pedido en esta pestaña se reutiliza sin preguntar durante esto. */
const VIGENCIA_MEMORIA = 60 * 1000

type Entrada = { uid: string; valor: unknown; pedido: number; enCurso: Promise<unknown> | null }

const entradas = new Map<FamiliaIA, Entrada>()
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())
export const suscribirEstadosIA = (f: () => void) => {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}

const clave = (familia: FamiliaIA, uid: string) => `mirdaily.ia.estado.v${VERSION}:${familia}:${uid}`

function leerGuardado(familia: FamiliaIA, uid: string): { valor: unknown } | null {
  try {
    const g = JSON.parse(window.localStorage.getItem(clave(familia, uid)) ?? 'null') as { t?: unknown; v?: unknown } | null
    if (!g || typeof g.t !== 'number' || Date.now() - g.t > VIGENCIA_GUARDADO) return null
    return { valor: g.v ?? null }
  } catch {
    return null
  }
}

function guardar(familia: FamiliaIA, uid: string, valor: unknown) {
  try {
    window.localStorage.setItem(clave(familia, uid), JSON.stringify({ t: Date.now(), v: valor }))
  } catch {
    // Sin almacenamiento (modo privado, cuota): solo se pierde la pintura instantánea.
  }
}

/** La entrada de este usuario; si es nueva (o ha cambiado la cuenta), sembrada con lo guardado. */
function entrada(familia: FamiliaIA, uid: string): Entrada {
  const e = entradas.get(familia)
  if (e && e.uid === uid) return e
  const guardado = leerGuardado(familia, uid)
  const nueva: Entrada = { uid, valor: guardado?.valor ?? null, pedido: 0, enCurso: null }
  entradas.set(familia, nueva)
  if (guardado || e) avisar()
  return nueva
}

/** Un «no» del servidor (sin sesión, sin permiso, sin plan, apagada), frente a «no se pudo saber». */
function esNegativa(err: unknown) {
  return err instanceof IAError && (err.status === 401 || err.status === 403 || err.status === 404)
}

/**
 * El estado de una familia: el de memoria si es de hace menos de 60 s (salvo `fresco`), si no lo pide
 * (uno a la vez). `pedir` lanza si no pudo preguntar; devuelve null si el servidor dice que no hay IA.
 */
export function consultarEstadoIA<T>(familia: FamiliaIA, uid: string, pedir: () => Promise<T | null>, { fresco = false } = {}): Promise<T | null> {
  const e = entrada(familia, uid)
  if (e.enCurso) return e.enCurso as Promise<T | null>
  if (!fresco && e.pedido && Date.now() - e.pedido < VIGENCIA_MEMORIA) return Promise.resolve(e.valor as T | null)
  const fijar = (valor: T | null) => {
    if (entradas.get(familia) !== e) return valor
    e.pedido = Date.now()
    guardar(familia, uid, valor)
    if (JSON.stringify(e.valor) !== JSON.stringify(valor)) {
      e.valor = valor
      avisar()
    }
    return valor
  }
  const p = pedir()
    .then(fijar, (err) => (esNegativa(err) ? fijar(null) : (e.valor as T | null)))
    .finally(() => {
      e.enCurso = null
    })
  e.enCurso = p
  return p
}

/** Tras una generación (cupo, saldo) o un cambio de plan: la próxima consulta vuelve a preguntar. */
export function caducarEstadosIA() {
  entradas.forEach((e) => {
    e.pedido = 0
  })
}

/** Lo que hay ahora para pintar (null si no se sabe o si no hay IA). */
export const valorEstadoIA = (familia: FamiliaIA): unknown => entradas.get(familia)?.valor ?? null

/** Solo para los tests: olvida lo de memoria. */
export function olvidarEstadosIA() {
  entradas.clear()
}
