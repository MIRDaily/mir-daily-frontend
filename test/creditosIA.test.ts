// Créditos de IA en la web, parte pura: el precio (misma fórmula que el servidor), los caracteres como
// los cuenta el servidor y los textos de cobro, devolución y cancelación.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  caracteresDocumento,
  caracteresLibro,
  caracteresRamaMapa,
  claveFlashcards,
  claveMapa,
  claveResumenes,
  limpiarEntrada,
  precioIA,
  type TarifaIA,
} from '@/lib/ia/precio'
import {
  avisoAntesDeCancelar,
  bolsaDelMes,
  describirMovimiento,
  fraccionGastada,
  mensajeCancelacion,
  mensajeDevolucion,
  mensajeRechazo,
  type Generacion,
  type Movimiento,
  type SaldoIA,
} from '@/lib/ia/creditosTexto'

const TARIFA: TarifaIA = {
  version: 1,
  cancelacionesGratisMes: 5,
  cancelacionSinTextoSeg: 5,
  claves: {
    'mapa:esquema': { fijo: '2.300', por_mil: '0.1280', factores: {} },
    'mapa:esquema+tablas': { fijo: 3.4, por_mil: 0.25, factores: {} },
    'mapa:detalle': { fijo: 2.7, por_mil: 0.182, factores: {} },
    'mapa:detalle+tablas': { fijo: 4.5, por_mil: 0.311, factores: {} },
    'flashcards:documento': { fijo: 1.4, por_mil: 0.172, factores: { pocas: 1, normal: 1, muchas: 1.45 } },
    'flashcards:mapa': { fijo: 1.8, por_mil: 0.164, factores: { pocas: 1, normal: 1, muchas: 1.45 } },
    'resumenes:resumen': { fijo: 2.3, por_mil: 0.174, factores: { pocas: 0.85, normal: 1, muchas: 1.1 } },
    'resumenes:literal': { fijo: 2.3, por_mil: 0.174, factores: { pocas: 0.85, normal: 1, muchas: 1.1 } },
    rama: { fijo: 5, por_mil: 0, factores: {} },
    indice: { fijo: 0, por_mil: 0, factores: {} },
  },
}

test('precioIA: la misma fórmula que el servidor (tema grande de la especificación)', () => {
  const p = (clave: string, densidad?: string) => precioIA(TARIFA, { clave, caracteres: 84000, ...(densidad ? { densidad } : {}) })
  assert.equal(p(claveMapa('esquema', false)), 14)
  assert.equal(p(claveMapa('esquema', true)), 25)
  assert.equal(p(claveMapa('detalle', false)), 18)
  assert.equal(p(claveMapa('detalle', true)), 31)
  assert.equal(p(claveFlashcards('documento'), 'normal'), 16)
  assert.equal(p(claveFlashcards('documento'), 'muchas'), 23)
  assert.equal(p(claveFlashcards('mapa'), 'pocas'), 16)
  assert.equal(p(claveResumenes('literal'), 'pocas'), 15)
  assert.equal(precioIA(TARIFA, { clave: 'mapa:esquema', caracteres: 421538, llamadas: 16 }), 91)
  assert.equal(precioIA(TARIFA, { clave: 'rama', caracteres: 99999 }), 5)
  assert.equal(precioIA(TARIFA, { clave: 'indice', caracteres: 99999 }), 0)
  assert.equal(precioIA(TARIFA, { clave: 'inventada' }), null)
  assert.equal(precioIA(null, { clave: 'mapa:esquema' }), null)
})

test('caracteres: el saneado del servidor (espacios, saltos, invisibles) y secciones de menos de 10', () => {
  assert.equal(limpiarEntrada('  Hola​   mundo \r\n\r\n\r\n\r\nadiós  '), 'Hola mundo\n\nadiós')
  assert.equal(limpiarEntrada('a\t\tb \n c'), 'a b\nc')
  assert.equal(caracteresDocumento([{ texto: 'corto' }, { texto: '   ' }, { texto: 'x'.repeat(50) }]), 50)
  assert.equal(caracteresDocumento([{ texto: '0123456789' }]), 10)
  assert.equal(caracteresDocumento([{ texto: '012345678' }]), 0)
})

test('caracteresLibro: la suma de los temas; un tema sin texto no paga su fijo', () => {
  const secciones = [{ texto: 'a'.repeat(100) }, { texto: 'b'.repeat(200) }, { texto: 'nada' }, { texto: 'c'.repeat(300) }, { texto: 'x'.repeat(999) }]
  assert.deepEqual(caracteresLibro(secciones, [{ desde: 0, hasta: 1 }, { desde: 2, hasta: 2 }, { desde: 3, hasta: 3 }]), { caracteres: 600, llamadas: 2 })
  assert.deepEqual(caracteresLibro(secciones, []), { caracteres: 0, llamadas: 1 })
})

test('caracteresRamaMapa: la rama como la manda el servidor (sangrada y saneada) más su fragmento', () => {
  const mapa = [{ d: 0, t: 'Diabetes' }, { d: 1, t: '**Clínica:** poliuria' }, { d: 1, t: 'x' }]
  // «Diabetes\n  Clínica: poliuria» (la línea de un carácter se descarta).
  assert.equal(caracteresRamaMapa(mapa), 'Diabetes\n  Clínica: poliuria'.length)
  assert.equal(caracteresRamaMapa(mapa, [{ texto: 'y'.repeat(40) }]), 'Diabetes\n  Clínica: poliuria'.length + 40)
})

const saldo = (extra: Partial<SaldoIA> = {}): SaldoIA => ({
  plan: 'mensual', estado: 'activo', periodo_inicio: null, periodo_fin: '2026-11-03T00:00:00Z', creditos_periodo: 700, ilimitado: false,
  puede_usar: true, total: 500, bolsas: [{ id: 1, tipo: 'periodo', iniciales: 700, saldo: 100, caduca_at: '2026-11-03T00:00:00Z', congelada: false }],
  cancelaciones_gratis_mes: 5, cancelaciones_gratis_restantes: 0, prueba_disponible: false, puede_recargar: false, ...extra,
})

test('aviso antes de cancelar: solo sin cancelaciones gratis y pasados los segundos «sin texto»', () => {
  const g: Generacion = { cobro: { creditosAnunciados: 20, tarifaVersion: 1, idempotencyKey: 'k' }, usageId: 3, inicio: 1000, cobrados: 20 }
  assert.match(avisoAntesDeCancelar(g, { saldo: saldo(), tarifa: TARIFA }, 1000 + 6000) ?? '', /como mucho 20 créditos/)
  assert.equal(avisoAntesDeCancelar(g, { saldo: saldo(), tarifa: TARIFA }, 1000 + 4000), null)
  assert.equal(avisoAntesDeCancelar(g, { saldo: saldo({ cancelaciones_gratis_restantes: 2 }), tarifa: TARIFA }, 99999), null)
  assert.equal(avisoAntesDeCancelar(g, { saldo: saldo({ ilimitado: true }), tarifa: TARIFA }, 99999), null)
})

test('mensajes de cancelación, devolución y rechazo', () => {
  const g: Generacion = { cobro: null, usageId: null, inicio: 0, cobrados: 14 }
  assert.equal(mensajeCancelacion({ prevision: 'gratis', creditos: 14, cancelacionesGratisRestantes: 4 }, g), 'Cancelado. Te hemos devuelto 14 créditos · te quedan 4 cancelaciones gratis este mes.')
  assert.match(mensajeCancelacion({ prevision: 'gratis', creditos: 14, cancelacionesGratisRestantes: 1 }, g), /te queda 1 cancelación gratis/)
  assert.match(mensajeCancelacion({ prevision: 'sin_texto', creditos: 14, cancelacionesGratisRestantes: 5 }, g), /no cuenta como cancelación/)
  assert.match(mensajeCancelacion({ prevision: 'parcial', creditos: 14, cancelacionesGratisRestantes: 0 }, g), /parte ya generada \(como mucho 14 créditos\)/)
  assert.equal(mensajeCancelacion(null, g), 'Cancelado. Te hemos devuelto 14 créditos.')
  assert.equal(mensajeDevolucion({ creditos: { cobrados: 0, devueltos: 17, saldo: 300 } }), ' No se ha cobrado nada.')
  assert.equal(mensajeDevolucion({ creditos: { cobrados: 9, devueltos: 11, saldo: 300 } }), ' Te hemos devuelto 11 créditos.')
  assert.equal(mensajeDevolucion(null), '')
  assert.match(mensajeRechazo('sin_creditos', { necesarios: 25, saldo: 3 }), /hacen falta 25 y tienes 3/)
  assert.match(mensajeRechazo('precio_cambiado', { creditos: 12345 }), /ahora son 12\.345 créditos/)
  assert.equal(mensajeRechazo('formato', {}), '')
})

test('saldo: la bolsa del mes y lo gastado; el historial en palabras', () => {
  assert.equal(bolsaDelMes(saldo())?.saldo, 100)
  assert.ok(Math.abs(fraccionGastada(saldo()) - 6 / 7) < 1e-9)
  assert.equal(bolsaDelMes(saldo({ bolsas: [] })), null)
  const m = (x: Partial<Movimiento>): Movimiento => ({ id: 1, tipo: 'cargo', creditos: -14, creado_at: '', bolsa_tipo: 'periodo', motivo: null, usage_id: 1, clave: 'mapa:esquema', kind: 'mapa', titulo: 'Vasculitis', ...x })
  assert.equal(describirMovimiento(m({})), 'Mapa · Vasculitis')
  assert.equal(describirMovimiento(m({ tipo: 'devolucion', creditos: 17, motivo: 'error' })), 'Devuelto (error) · Vasculitis')
  assert.equal(describirMovimiento(m({ tipo: 'alta', creditos: 700, usage_id: null, titulo: null, clave: null, kind: null, motivo: 'renovacion' })), 'Renovación')
  assert.equal(describirMovimiento(m({ tipo: 'caducidad', creditos: -120, titulo: null })), 'Caducados')
  assert.equal(describirMovimiento(m({ clave: 'flashcards_mas', kind: 'flashcards_mas', titulo: null })), 'Más flashcards')
  assert.equal(describirMovimiento(m({ tipo: 'alta', bolsa_tipo: 'ajuste', motivo: 'compensación', clave: null, kind: null, titulo: null })), 'Regalo del equipo · compensación')
})
