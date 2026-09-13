/* ════════════════════════════════════════════════════════════════════════
   Qué tutoriales ha visto ya este usuario.

   La verdad vive en el servidor (users.tutorials_seen) porque web y app son
   la misma cuenta: si el flag fuese solo local, quien hiciera el onboarding
   en el móvil se comería todos los tutoriales otra vez al abrir la web.

   localStorage es una caché por delante, no la fuente. Sirve para dos cosas:
   que el primer render no espere al perfil, y que un fallo de red no haga
   que un tutorial se repita en bucle en esta misma sesión.
═══════════════════════════════════════════════════════════════════════════ */

const CLAVE_VISTOS = 'tutorials.seen'
const CLAVE_ACTIVOS = 'tutorials.enabled'

function leerLista(clave: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const crudo = window.localStorage.getItem(clave)
    if (!crudo) return []
    const lista: unknown = JSON.parse(crudo)
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // Modo privado o JSON corrupto: se trata como "no ha visto nada". Peor es
    // que una excepción aquí tumbe el provider y con él la página entera.
    return []
  }
}

export function leerVistosLocales(): string[] {
  return leerLista(CLAVE_VISTOS)
}

export function guardarVistosLocales(claves: Iterable<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...new Set(claves)]))
  } catch {
    // Sin almacenamiento la preferencia vive solo en memoria. Aceptable: el
    // coste es que un tutorial se repita, no que algo se rompa.
  }
}

/* ── Interruptor de Configuración ─────────────────────────────────────────
   Mismo patrón que el cursor de marca: preferencia local, expuesta como
   store externo para que `useSyncExternalStore` la lea sin desincronizarse
   entre pestañas del mismo navegador.

   Va aparte de `tutorials_seen` a propósito: "no quiero tutoriales" es una
   preferencia de este navegador, no un dato de la cuenta. Quien lo apague en
   el portátil no tiene por qué apagarlo también en el móvil.
─────────────────────────────────────────────────────────────────────────── */

export const TUTORIALES_EVENT = 'mirdaily:tutoriales-activos'

// Si localStorage no está disponible (modo privado) la preferencia vive solo
// en memoria y dura lo que la pestaña.
let activosEnMemoria = true

/** Los tutoriales se pueden apagar del todo desde Configuración. */
export function tutorialesActivos(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(CLAVE_ACTIVOS) !== 'false'
  } catch {
    return activosEnMemoria
  }
}

export function setTutorialesActivos(valor: boolean) {
  if (typeof window === 'undefined') return
  activosEnMemoria = valor
  try {
    window.localStorage.setItem(CLAVE_ACTIVOS, String(valor))
  } catch {
    /* ver arriba */
  }
  window.dispatchEvent(new Event(TUTORIALES_EVENT))
}

export function subscribeTutorialesActivos(alCambiar: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(TUTORIALES_EVENT, alCambiar)
  // `storage` cubre el caso de tenerlo abierto en dos pestañas.
  window.addEventListener('storage', alCambiar)
  return () => {
    window.removeEventListener(TUTORIALES_EVENT, alCambiar)
    window.removeEventListener('storage', alCambiar)
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/**
 * Marca un tutorial como visto. Escribe la caché local ANTES de la red: si el
 * POST falla, el usuario no vuelve a comerse el mismo tutorial al cambiar de
 * pestaña, que es el fallo que más molestaría.
 */
export async function marcarVisto(
  apiUrl: string,
  authenticatedFetch: Fetcher,
  clave: string,
): Promise<void> {
  guardarVistosLocales([...leerVistosLocales(), clave])

  if (!apiUrl) return

  try {
    await authenticatedFetch(`${apiUrl}/api/profile/tutorials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: clave }),
    })
  } catch {
    // Se reintentará solo: la próxima vez que toque ese tutorial, la caché
    // local lo frena aquí y el servidor se enterará cuando se marque otro.
  }
}

/** Reinicio desde Configuración: borra servidor y caché. */
export async function reiniciarTutoriales(
  apiUrl: string,
  authenticatedFetch: Fetcher,
): Promise<void> {
  guardarVistosLocales([])
  if (!apiUrl) return
  await authenticatedFetch(`${apiUrl}/api/profile/tutorials`, { method: 'DELETE' })
}
