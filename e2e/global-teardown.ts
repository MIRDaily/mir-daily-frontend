/** Después de los E2E: limpieza de todo lo que han creado las cuentas de prueba. */
import { limpiar } from './entorno'

export default async function globalTeardown() {
  console.log('Limpieza final:', limpiar().trim().split('\n').at(-2))
}
