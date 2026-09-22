// Engancha el resolvedor de `@/...` (ver alias-loader.mjs) por la vía moderna:
// `--experimental-loader` sigue funcionando pero avisa por consola en cada
// ejecución, y `register` es lo que Node recomienda desde la 20.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./alias-loader.mjs', pathToFileURL(import.meta.filename))
