/**
 * Antes de los E2E: limpieza de las cuentas de prueba y sesión de test-e2e-web.
 *
 * La sesión NO se consigue tecleando la contraseña en el formulario: se pide a Supabase desde Node con
 * el mismo cliente de @supabase/ssr que usa la web y se guardan sus cookies (e2e/.auth/web.json, fuera
 * de git). Además se marca el onboarding como «omitido», que es lo que hace el botón «Omitir por
 * ahora» (una marca en localStorage; no escribe en la base de datos).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createServerClient } from '@supabase/ssr'
import { EMAIL, faltan, limpiar } from './entorno'

export default async function globalSetup() {
  const sinVariables = faltan()
  if (sinVariables.length) throw new Error(`E2E: faltan ${sinVariables.join(', ')} (ver e2e/README.md)`)

  console.log('Limpieza previa:', limpiar().trim().split('\n').at(-2))

  const base = new URL(process.env.E2E_BASE_URL || 'https://mir-daily-frontend.vercel.app')
  const tarro = new Map<string, string>()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...tarro].map(([name, value]) => ({ name, value })),
      setAll: (lista: { name: string; value: string }[]) => lista.forEach(({ name, value }) => tarro.set(name, value)),
    },
  })
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: process.env.E2E_PASSWORD! })
  if (error) throw new Error(`No se pudo entrar con ${EMAIL}: ${error.message}`)

  const estado = {
    cookies: [...tarro].map(([name, value]) => ({
      name, value, domain: base.hostname, path: '/', expires: -1,
      httpOnly: false, secure: base.protocol === 'https:', sameSite: 'Lax' as const,
    })),
    origins: [{ origin: base.origin, localStorage: [{ name: 'onboarding.deferred', value: '1' }] }],
  }
  const ruta = path.join(__dirname, '.auth', 'web.json')
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, JSON.stringify(estado))
}
