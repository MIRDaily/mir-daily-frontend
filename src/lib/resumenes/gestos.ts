// Resúmenes activos: los gestos con el dedo (puro, se prueba con `npm test`).
//
// - Al estudiar, con un hueco destapado: deslizar a la DERECHA = «Lo sabía», a la IZQUIERDA = «No lo
//   sabía». Cuenta si el dedo se ha movido lo bastante en horizontal y más en horizontal que en
//   vertical (si no, es que se está desplazando la página).
// - Al editar huecos: mantener el dedo sobre una palabra y arrastrar marca un trozo; o «Marcar un
//   trozo»: tocar la palabra del principio y la del final. Aquí, el trozo entre dos palabras tocadas.

export type Deslizar = 'sabia' | 'no' | null

/** Distancia mínima (px) para que un deslizamiento cuente: el 22 % del ancho de la tarjeta, entre 64 y 120. */
export function umbralDeslizar(ancho: number): number {
  return Math.min(120, Math.max(64, Math.round(ancho * 0.22)))
}

/** ¿Qué respuesta da un deslizamiento de (dx, dy) sobre una tarjeta de `ancho` px? */
export function respuestaDeslizar(dx: number, dy: number, ancho: number): Deslizar {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (Math.abs(dx) < umbralDeslizar(ancho)) return null
  // Un movimiento casi vertical es desplazar la página, no contestar.
  if (Math.abs(dy) > Math.abs(dx) * 0.6) return null
  return dx > 0 ? 'sabia' : 'no'
}

/** Mientras se arrastra: cuánto se ve el sello «Lo sabía» / «No lo sabía» (0-1) y hacia dónde. */
export function progresoDeslizar(dx: number, ancho: number): { hacia: Deslizar; fuerza: number } {
  if (!Number.isFinite(dx) || dx === 0) return { hacia: null, fuerza: 0 }
  return { hacia: dx > 0 ? 'sabia' : 'no', fuerza: Math.min(1, Math.abs(dx) / umbralDeslizar(ancho)) }
}

/** ¿Se ha movido el dedo lo bastante para que no sea un toque ni un «mantener»? */
export function seHaMovido(dx: number, dy: number, tolerancia = 10): boolean {
  return Math.hypot(dx, dy) > tolerancia
}

/**
 * El trozo de texto entre dos palabras tocadas (en cualquier orden): de la primera letra de la que va
 * antes a la última de la que va después. Cada palabra = { pos, largo }.
 */
export function trozoEntre(a: { pos: number; largo: number }, b: { pos: number; largo: number }): { i: number; f: number } {
  const [x, y] = a.pos <= b.pos ? [a, b] : [b, a]
  return { i: x.pos, f: Math.max(x.pos + x.largo, y.pos + y.largo) }
}
