/**
 * Resolvedor de `@/...` para `node --test`.
 *
 * El proyecto no tenía runner de tests (solo `next build` y `eslint`), y meter
 * uno de verdad (vitest, jest) arrastra veinte dependencias para comprobar
 * cuatro funciones puras. Node 24 ya sabe ejecutar TypeScript —le quita los
 * tipos y lo corre— y trae su propio `node:test`; lo único que le falta es el
 * alias `@/` del tsconfig, que son estas quince líneas.
 *
 *   npm test
 *
 * Limitación conocida y aceptada: esto vale para lógica pura (lib/, services/).
 * Para probar componentes de React haría falta un DOM, y eso sí pide un runner
 * de verdad.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = path.resolve(import.meta.dirname, '..')

export function resolve(especificador, contexto, siguiente) {
  if (!especificador.startsWith('@/')) return siguiente(especificador, contexto)

  const base = path.join(raiz, 'src', especificador.slice(2))
  // El import del tsconfig va sin extensión; aquí hay que ponerla.
  for (const candidato of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidato)) {
      return { url: pathToFileURL(candidato).href, shortCircuit: true }
    }
  }
  return siguiente(especificador, contexto)
}
