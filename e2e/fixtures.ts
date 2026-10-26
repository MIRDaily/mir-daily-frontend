/**
 * `test` de los E2E: cierra solos los tutoriales de la mascota (diálogos con «Saltar») cuando se
 * cruzan, y da el token de la sesión para preparar datos por la API.
 */
import fs from 'node:fs'
import path from 'node:path'
import { test as base, expect } from '@playwright/test'

type Estado = { cookies: { name: string; value: string }[] }

/** El access_token de la cookie de sesión de Supabase (la guarda global-setup). */
function tokenDeSesion(): string {
  const estado = JSON.parse(fs.readFileSync(path.join(__dirname, '.auth', 'web.json'), 'utf8')) as Estado
  const trozos = estado.cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
    .map((c) => c.value)
    .join('')
  const json = trozos.startsWith('base64-') ? Buffer.from(trozos.slice(7), 'base64url').toString('utf8') : trozos
  return (JSON.parse(json) as { access_token: string }).access_token
}

export const test = base.extend<{ token: string }>({
  page: async ({ page }, usar) => {
    await page.addLocatorHandler(page.getByRole('dialog').getByRole('button', { name: 'Saltar', exact: true }), async (boton) => {
      await boton.click()
    })
    await usar(page)
  },
  token: async ({}, usar) => {
    await usar(tokenDeSesion())
  },
})

export { expect }
