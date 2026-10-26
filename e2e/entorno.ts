/**
 * Entorno de los E2E: variables, la cuenta de prueba, la limpieza y llamadas directas a la API.
 *
 * Variables (en local salen de .env.local y de ~/.mirdaily-e2e.env, fuera del repo):
 *   E2E_PASSWORD                    contraseña de las cuentas test-e2e-*
 *   NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
 *   E2E_API_URL                     backend (por defecto el de producción)
 *   MIRDAILY_BACKEND_DIR            carpeta del backend, donde vive la limpieza
 *                                   (por defecto ../mir-daily-backend-clone)
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const RAIZ = path.resolve(__dirname, '..')
// Lo que ya venga en el entorno manda (loadEnvFile no pisa variables existentes).
for (const fichero of [path.join(RAIZ, '.env.local'), process.env.MIRDAILY_E2E_ENV || path.join(os.homedir(), '.mirdaily-e2e.env')]) {
  if (fs.existsSync(fichero)) process.loadEnvFile(fichero)
}

export const EMAIL = 'test-e2e-web@mirdaily.test'
export const API_URL = (process.env.E2E_API_URL || 'https://mir-daily-backend-production.up.railway.app').replace(/\/$/, '')
export const BACKEND_DIR = process.env.MIRDAILY_BACKEND_DIR || path.resolve(RAIZ, '..', 'mir-daily-backend-clone')

// Asignatura «ZZZ · Pruebas (no estudiar)»: 8 preguntas de casos límite, fuera del daily.
export const ASIGNATURA_PRUEBAS = 'ZZZ · Pruebas (no estudiar)'
export const PREGUNTAS_PRUEBA = [1415, 1416, 1417, 1418, 1419, 1420, 1421, 1422]

export function faltan(): string[] {
  return ['E2E_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter((k) => !process.env[k])
}

/**
 * Borra todo lo de las cuentas de prueba con el script del backend, que se niega a tocar cualquier
 * otra cuenta (scripts/pruebas/limpiar-cuentas-prueba.js).
 */
export function limpiar(): string {
  return execFileSync(process.execPath, [path.join(BACKEND_DIR, 'scripts', 'pruebas', 'limpiar-cuentas-prueba.js')], {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

/** Llamada a la API con el token de la sesión de la prueba. Para preparar datos, no para comprobar la web. */
export async function api<T = unknown>(token: string, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(API_URL + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${JSON.stringify(b)}`)
  return b as T
}
