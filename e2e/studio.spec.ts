/**
 * Humo de Studio: lo que un estudiante hace de verdad, de punta a punta, con la cuenta test-e2e-web.
 * Cada prueba deja datos en esa cuenta; global-teardown los borra todos.
 */
import { test, expect } from './fixtures'
import { api, ASIGNATURA_PRUEBAS, PREGUNTAS_PRUEBA } from './entorno'

test('portada de Studio', async ({ page }) => {
  await page.goto('/studio')
  await expect(page.getByRole('heading', { name: 'Studio', level: 1 })).toBeVisible()
  for (const modulo of ['Preguntas y Simulacros', 'Mazos', 'Flashcards', 'Sala Zen']) {
    await expect(page.getByRole('heading', { name: modulo, level: 3 })).toBeVisible()
  }
  for (const acceso of ['Mapas mentales', 'Resúmenes activos']) {
    await expect(page.getByRole('heading', { name: acceso, level: 4 })).toBeVisible()
  }
})

test.describe('simulacro', () => {
  /** Responde la A en todas y avanza; con corrección inmediata, comprueba cada una antes. */
  async function responderTodas(page: import('@playwright/test').Page, total: number, inmediata: boolean) {
    for (let i = 1; i <= total; i++) {
      await expect(page.getByText(`${i} / ${total}`, { exact: true })).toBeVisible()
      await page.getByRole('button', { name: /^A\)/ }).click()
      if (inmediata) {
        await page.getByRole('button', { name: /^Comprobar/ }).click()
        await expect(page.getByRole('button', { name: /Dejar en blanco/ })).toBeDisabled()
      }
      if (i < total) await page.getByRole('button', { name: /^Siguiente/ }).click()
    }
    await page.getByRole('button', { name: /^Finalizar/ }).click()
    await expect(page.getByText('Simulacro completado')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Pregunta \d+$/ })).toHaveCount(total)
  }

  test('corto (8, corrección inmediata): de punta a punta y no entra al historial', async ({ page }) => {
    await page.goto('/studio/simulacro')
    await page.getByRole('button', { name: ASIGNATURA_PRUEBAS }).click()
    await page.getByRole('button', { name: /Corrección inmediata/ }).click()
    await page.getByRole('button', { name: /Generar simulacro/ }).click()
    await responderTodas(page, PREGUNTAS_PRUEBA.length, true)
    await expect(page.getByRole('button', { name: /^Anuladas\d/ })).toHaveText(/2$/)

    await page.goto('/studio/simulacro/historial')
    await expect(page.getByRole('heading', { name: 'Tus simulacros', level: 1 })).toBeVisible()
    await expect(page.getByText(/Sin simulacros guardados en \d{4}\./)).toBeVisible()
  })

  test('de 50 (corrección al final): entra al historial y se puede repasar', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/studio/simulacro')
    await page.getByRole('button', { name: 'Cardiología y Cirugía Cardiovascular' }).click()
    await page.getByRole('button', { name: '50', exact: true }).click()
    await page.getByRole('button', { name: /Corrección al final/ }).click()
    await page.getByRole('button', { name: /Generar simulacro/ }).click()
    await responderTodas(page, 50, false)

    await page.goto('/studio/simulacro/historial')
    await expect(page.getByText(/Sin simulacros guardados/)).toHaveCount(0)
    // Las anuladas no puntúan y no cuentan en el total que se enseña (50 respondidas → 48 o 49 si hay alguna).
    const fila = page.getByRole('button', { name: /\d+ preguntas · \d+% de aciertos/ })
    await expect(fila).toHaveCount(1)
    await fila.click()
    await expect(page).toHaveURL(/\/studio\/simulacro\/historial\/[0-9a-f-]{36}/)
    await expect(page.getByRole('button', { name: /^Pregunta \d+$/ }).first()).toBeVisible()
    expect(await page.getByRole('button', { name: /^Pregunta \d+$/ }).count()).toBeGreaterThanOrEqual(45)
  })
})

test('mazo: abrir y estudiar 3 preguntas', async ({ page, token }) => {
  // El mazo se prepara por la API (lo que se prueba es abrirlo y estudiarlo, no crearlo).
  const { deck } = await api<{ deck: { id: string } }>(token, 'POST', '/api/studio/decks', { name: 'e2e mazo' })
  await api(token, 'POST', `/api/studio/decks/${deck.id}/items`, { questionIds: PREGUNTAS_PRUEBA })

  await page.goto(`/decks/${deck.id}`)
  await expect(page.getByRole('heading', { name: 'e2e mazo', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: `quiz Preguntas ${PREGUNTAS_PRUEBA.length}` })).toBeVisible()
  await page.getByRole('button', { name: /Estudiar/ }).click()
  await page.getByRole('textbox', { name: 'Número de preguntas' }).fill('3')
  await page.getByRole('button', { name: /Empezar/ }).click()

  for (let i = 1; i <= 3; i++) {
    // Se espera a que la respuesta quede guardada antes de seguir. La web la manda en segundo plano y,
    // si se pulsa «Siguiente» en la última antes de que llegue, el resumen sale con una de menos
    // (fallo conocido, apuntado en el plan de Studio). Aquí se prueba el camino normal.
    const guardada = page.waitForResponse((r) => r.url().endsWith('/log') && r.request().method() === 'POST')
    await page.getByRole('button', { name: /^A / }).click()
    expect((await guardada).status()).toBe(200)
    await page.getByRole('button', { name: /Siguiente/ }).click()
  }

  await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}\/summary/)
  await expect(page.getByText('Sesión finalizada')).toBeVisible()
  const respondidas = page.getByText('Respondidas', { exact: true }).locator('xpath=preceding-sibling::p[1]')
  await expect(respondidas).toHaveText('3')
})

test('flashcards: crear, estudiar y deshacer', async ({ page }) => {
  await page.goto('/flashcards')
  await page.getByRole('button', { name: /Nueva asignatura/ }).click()
  await page.getByRole('textbox', { name: 'p. ej. Cardiología' }).fill('e2e flashcards')
  await page.getByRole('button', { name: 'Crear asignatura' }).click()
  await page.getByRole('button', { name: /^EF style e2e flashcards/ }).click()
  await expect(page.getByRole('heading', { name: 'e2e flashcards', level: 1 })).toBeVisible()

  // Crear
  await page.getByRole('button', { name: /Crear tarjetas/ }).first().click()
  await page.getByRole('textbox', { name: 'Pregunta o concepto' }).fill('Anverso e2e')
  await page.getByRole('textbox', { name: 'Respuesta o explicación' }).fill('Reverso e2e')
  await page.getByRole('button', { name: /Guardar y otra/ }).click()
  await expect(page.getByText('+1 creada')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()

  // Estudiar
  await page.getByRole('button', { name: /Estudiar/ }).first().click()
  await page.getByRole('dialog', { name: 'Ajustes de la sesión' }).getByRole('button', { name: 'Empezar' }).click()
  await expect(page.getByText('Anverso e2e')).toBeVisible()
  await expect(page.getByRole('button', { name: /Deshacer/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Mostrar respuesta' }).last().click()
  const repaso = page.waitForResponse((r) => r.url().endsWith('/log') && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Otra vez/ }).click()
  expect((await repaso).status()).toBe(200)
  await expect(page.getByText('1 repasadas')).toBeVisible()

  // Deshacer
  const deshacer = page.waitForResponse((r) => r.url().endsWith('/undo'))
  await page.getByRole('button', { name: /Deshacer/ }).click()
  expect((await deshacer).status()).toBe(200)
  await expect(page.getByText('0 repasadas')).toBeVisible()
  await expect(page.getByRole('button', { name: /Deshacer/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Otra vez/ })).toBeVisible()
})

test('resumen activo: crear grupo, estudiar un párrafo y terminar', async ({ page, token }) => {
  await page.goto('/resumenes')
  await page.getByRole('button', { name: /Nuevo grupo/ }).click()
  await page.getByRole('textbox', { name: 'Nombre del grupo' }).fill('e2e resumen')
  await page.getByRole('button', { name: /Crear/ }).click()
  await expect(page).toHaveURL(/\/resumenes\/[0-9a-f-]{36}/)
  const grupo = page.url().match(/resumenes\/([0-9a-f-]{36})/)![1]

  // El párrafo con su hueco se añade por la API: marcar huecos a mano es seleccionar texto, y lo que
  // se prueba aquí es el estudio.
  const texto = 'La causa más frecuente de hipotiroidismo es la tiroiditis de Hashimoto.'
  const hueco = 'tiroiditis de Hashimoto'
  const i = texto.indexOf(hueco)
  await api(token, 'POST', `/api/resumenes/${grupo}/parrafos`, { parrafos: [{ tema: 'Tiroides', texto, huecos: [{ i, f: i + hueco.length, n: 2 }] }] })
  await page.reload()
  await expect(page.locator('main')).toContainText(/1\s*párrafos\s*1\s*huecos\s*1\s*por repasar/)
  await expect(page.getByRole('button', { name: /Estudiar/ })).toBeEnabled()

  await page.getByRole('button', { name: /Estudiar/ }).click()
  await page.getByRole('dialog', { name: 'Ajustes de la sesión' }).getByRole('button', { name: 'Empezar' }).click()
  await expect(page.getByText('La causa más frecuente de hipotiroidismo es la')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Hueco tapado/ }).click()
  await expect(page.getByRole('status').filter({ hasText: `Destapado: ${hueco}` })).toBeVisible()
  await page.getByRole('button', { name: /^Lo sabía/ }).click()
  await expect(page.getByRole('radio', { name: 'Bien 3' })).toBeChecked()
  const repaso = page.waitForResponse((r) => r.url().endsWith('/repaso'))
  await page.getByRole('button', { name: /^Siguiente/ }).click()
  expect((await repaso).status()).toBe(200)
  await expect(page.getByText('¡Sesión terminada!')).toBeVisible()
  await expect(page.getByText('100 %')).toBeVisible()
})

test('mapa: crear, editar y comprobar que se guarda', async ({ page }) => {
  await page.goto('/mapas')
  await page.getByRole('button', { name: /Nuevo mapa/ }).click()
  await expect(page).toHaveURL(/\/mapas\/[0-9a-f-]{36}/)
  const titulo = page.getByRole('textbox', { name: 'Título del mapa' })
  const lienzo = page.getByRole('application')
  await expect(lienzo.getByRole('group')).toHaveCount(1)

  // Editar: título y una idea nueva colgando del tema principal.
  await titulo.fill('e2e mapa')
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(lienzo.getByRole('group').filter({ hasText: 'Nueva idea' })).toHaveCount(1)
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible({ timeout: 20_000 })

  // Se ha guardado: tras recargar sigue igual, y sale en la lista con su título.
  await page.reload()
  await expect(titulo).toHaveValue('e2e mapa')
  await expect(lienzo.getByRole('group')).toHaveCount(2)
  await page.goto('/mapas')
  await expect(page.getByText('e2e mapa')).toBeVisible()
})

test('Sala Zen individual: entrar y arrancar el pomodoro', async ({ page }) => {
  await page.goto('/zen')
  await expect(page.getByRole('button', { name: /Yo solo/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Entrar a la sala/ }).click()
  await expect(page).toHaveURL(/\/zen\/room\?.*mode=solo/)
  const sala = page.getByRole('img', { name: 'Sala de estudio Zen' })
  await expect(sala).toBeVisible()
  await expect(sala.getByText('@test-e2e-web')).toBeVisible()
  await expect(page.getByText('25:00')).toBeVisible()
  await page.getByRole('button', { name: /Iniciar/ }).click()
  await expect(page.getByText('25:00')).toHaveCount(0, { timeout: 5_000 })
  await expect(page.getByText(/^24:5\d$/)).toBeVisible()
})
