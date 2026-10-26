// Sentry de la web (lib/observabilidad/sentry.ts): apagado sin DSN y sin datos personales.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { limpiarEvento, limpiarMiga, limpiarTramo, opcionesSentry } from '@/lib/observabilidad/sentry'

const JWT = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJhZmFsc2E'

test('sin DSN: apagado', () => {
  assert.equal(opcionesSentry('navegador', {}), null)
  assert.equal(opcionesSentry('servidor', { NEXT_PUBLIC_SENTRY_DSN: '' }), null)
})

test('con DSN: sin datos personales; el navegador sin trazas y el servidor con muestreo bajo', () => {
  const nav = opcionesSentry('navegador', { NEXT_PUBLIC_SENTRY_DSN: 'https://x@o0.ingest.sentry.io/1' })!
  const srv = opcionesSentry('servidor', { NEXT_PUBLIC_SENTRY_DSN: 'https://x@o0.ingest.sentry.io/1' })!
  assert.equal(nav.sendDefaultPii, false)
  assert.equal(nav.tracesSampleRate, 0)
  assert.equal(srv.tracesSampleRate, 0.02)
  assert.equal('integrations' in nav, false, 'sin Replay ni trazas en el navegador')
  const dc = srv.dataCollection as { httpBodies: unknown[]; userInfo: boolean; cookies: boolean; urlQueryParams: boolean }
  assert.deepEqual(dc.httpBodies, [])
  assert.equal(dc.userInfo, false)
  assert.equal(dc.cookies, false)
  assert.equal(dc.urlQueryParams, false)
  assert.equal(opcionesSentry('servidor', { NEXT_PUBLIC_SENTRY_DSN: 'x', SENTRY_TRACES_SAMPLE_RATE: '5' })!.tracesSampleRate, 0.02)
  assert.equal(opcionesSentry('servidor', { NEXT_PUBLIC_SENTRY_DSN: 'x', NEXT_PUBLIC_APP_VERSION: 'dev' })!.release, undefined)
  assert.equal(opcionesSentry('servidor', { NEXT_PUBLIC_SENTRY_DSN: 'x', NEXT_PUBLIC_APP_VERSION: 'abc12345' })!.release, 'abc12345')
})

test('limpiarEvento quita usuario, cuerpo, cookies, consulta y cabeceras; tacha emails y tokens', () => {
  const e = limpiarEvento({
    user: { id: 'u1', email: 'alguien@ejemplo.com' },
    request: {
      url: 'https://mirdaily/studio?email=a@b.com',
      data: '{"password":"secreto"}',
      cookies: { sb: 'x' },
      query_string: 'q=1',
      headers: { authorization: `Bearer ${JWT}`, 'user-agent': 'Mozilla', cookie: 'x=y' },
    },
    message: `fallo de alguien@ejemplo.com con ${JWT}`,
    exception: { values: [{ value: 'usuario pepe@correo.es' }] },
    breadcrumbs: [
      { category: 'fetch', data: { url: 'https://api/x?token=1', method: 'GET' } },
      { category: 'console', message: 'hola a@b.com' },
    ],
  })!
  const s = JSON.stringify(e)
  assert.equal(/@ejemplo|@correo|a@b\.com|eyJ|secreto|token=1/.test(s), false, s)
  assert.deepEqual((e.request as { headers: unknown }).headers, { 'user-agent': 'Mozilla' })
  assert.equal(e.user, undefined)
})

test('limpiarTramo y limpiarMiga', () => {
  const t = limpiarTramo({ name: 'GET /x?y=1', attributes: { 'url.full': 'https://x/y?z=1', 'user.id': 'u', 'http.query': 'a' } })!
  assert.deepEqual(t, { name: 'GET /x', attributes: { 'url.full': 'https://x/y' } })
  assert.deepEqual(limpiarMiga({ category: 'ui.click' }), { category: 'ui.click' })
})
