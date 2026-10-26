# E2E de humo de Studio (Playwright)

Recorren Studio como un estudiante, contra la web de verdad (hoy, producción: no hay staging hasta el
lanzamiento) y con la cuenta de prueba `test-e2e-web@mirdaily.test`. **Nunca con la cuenta del dueño.**

| Prueba | Qué comprueba |
|---|---|
| portada de Studio | carga y enseña sus módulos |
| simulacro corto | 8 preguntas de «ZZZ · Pruebas» con corrección inmediata, resultados, y que NO entra al historial |
| simulacro de 50 | 50 de Cardiología con corrección al final, entra al historial y se puede repasar |
| mazo | abrir un mazo y estudiar 3 preguntas hasta el resumen de la sesión |
| flashcards | crear un grupo y una tarjeta, estudiarla y deshacer el repaso |
| resumen activo | crear un grupo, estudiar un párrafo con su hueco y terminar la sesión |
| mapa | crear, editar (título y una idea) y comprobar que se guarda tras recargar |
| Sala Zen | entrar en la sala individual y arrancar el pomodoro |

## Cómo se lanzan

```bash
npm run e2e
```

Necesitan (en local salen de `.env.local` y de `~/.mirdaily-e2e.env`, fuera del repo):

- `E2E_PASSWORD`: la contraseña de las cuentas `test-e2e-*` (la crea `scripts/pruebas/crear-cuentas-prueba.js`
  del backend).
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- La carpeta del backend al lado (`../mir-daily-backend-clone`, o `MIRDAILY_BACKEND_DIR`) con su `.env`:
  de ahí sale la limpieza.

Opcionales: `E2E_BASE_URL` (otra web, p. ej. una preview de Vercel), `E2E_API_URL` (otro backend) y
`E2E_CHANNEL` (por defecto el Chrome instalado; vacío = el Chromium de Playwright, que se instala con
`npx playwright install chromium`).

## Cómo funcionan

- **Entrada sin formulario:** `global-setup.ts` pide la sesión a Supabase desde Node con el mismo cliente de
  `@supabase/ssr` que la web y guarda sus cookies en `e2e/.auth/` (fuera de git). Marca el onboarding como
  omitido, igual que el botón «Omitir por ahora».
- **Tutoriales:** los diálogos de la mascota se cierran solos con «Saltar» cuando aparecen (`fixtures.ts`).
- **Datos:** donde lo que se prueba no es crear (el mazo con sus preguntas, el párrafo con su hueco) se
  prepara por la API.
- **Limpieza:** antes y después se ejecuta `scripts/pruebas/limpiar-cuentas-prueba.js` del backend, que borra
  todo lo de las cuentas de prueba y se niega a tocar cualquier otra.
- Resultados, capturas y trazas de los fallos: `e2e/resultados/` (fuera de git).
