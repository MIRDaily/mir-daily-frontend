// Flashcards con IA II (navegador): borrador de la vista previa (claves, caducidad, saneado al leer,
// «hace …»), origen de cada tarjeta al guardar, niveles para empezar y `?niveles=`.
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caducado, claveBorrador, haceCuanto, sanearBorrador } from '@/lib/flashcards/ia/borrador'
import { borradores, leerNivelesURL, nivelesParaEmpezar, paraGuardar, sanitizeTarjetas } from '@/lib/flashcards/ia/tarjetas'

test('claveBorrador: uno por usuario y origen (cada mapa el suyo)', () => {
  assert.equal(claveBorrador('u1', { tipo: 'documento' }), 'u1:documento')
  assert.equal(claveBorrador('u1', { tipo: 'mapa', mapId: 'm9', nodeId: 'n3' }), 'u1:mapa:m9')
})

test('caducado y haceCuanto', () => {
  const ahora = 1_000_000_000_000
  assert.equal(caducado({ caduca: ahora + 1 }, ahora), false)
  assert.equal(caducado({ caduca: ahora }, ahora), true)
  assert.equal(caducado(null, ahora), true)
  assert.equal(haceCuanto(ahora - 20_000, ahora), 'hace un momento')
  assert.equal(haceCuanto(ahora - 5 * 60_000, ahora), 'hace 5 min')
  assert.equal(haceCuanto(ahora - 3 * 3_600_000, ahora), 'hace 3 h')
  assert.equal(haceCuanto(ahora - 26 * 3_600_000, ahora), 'hace 1 día')
})

test('sanearBorrador: reconstruye lo leído de IndexedDB y conserva las ediciones', () => {
  const lista = [
    { key: 't0', tema: 'ACG', nivel: 2, pregunta: '¿Edad? (editada)', respuesta: '>50 años', incluir: false, grupo: 'Tema 3', ia: { pagina: 4, fragmento: 'Afecta a mayores de 50 años.' } },
    { key: 't1', tema: 'ACG', nivel: 9, pregunta: '¿Mala?', respuesta: 'x', incluir: true },
    { key: 't2', tema: '<b>ACG</b>', nivel: 4, pregunta: '¿Biopsia?', respuesta: 'Temporal', otro: 'campo' },
  ]
  const b = sanearBorrador({
    clave: 'u1:documento', usuario: 'u1', origen: { tipo: 'documento' }, titulo: 'Vasculitis', nombreGrupo: 'Vasculitis (prueba)',
    fuente: { nombre: 'Tema_03.pdf', unidad: 'pagina', raro: 1 }, lista, fallidos: ['Tema 9: no salió', 3], creado: 5, actualizado: 6, caduca: 7,
  })!
  assert.equal(b.lista.length, 2)
  assert.deepEqual(b.lista[0], { tema: 'ACG', nivel: 2, pregunta: '¿Edad? (editada)', respuesta: '>50 años', ia: { pagina: 4, fragmento: 'Afecta a mayores de 50 años.' }, key: 't0', incluir: false, grupo: 'Tema 3' })
  assert.equal(b.lista[1].key, 't2')
  assert.equal(b.lista[1].incluir, true)
  assert.deepEqual(b.fuente, { nombre: 'Tema_03.pdf', unidad: 'pagina' })
  assert.deepEqual(b.fallidos, ['Tema 9: no salió'])
  assert.equal(sanearBorrador({ clave: 'x', usuario: 'u', origen: { tipo: 'otro' }, lista }), null)
  assert.equal(sanearBorrador({ clave: 'x', usuario: 'u', origen: { tipo: 'documento' }, lista: [] }), null)
  assert.equal(sanearBorrador('basura'), null)
})

test('sanitizeTarjetas: el fragmento de origen se conserva y se acota', () => {
  const [t] = sanitizeTarjetas([{ tema: 'A', nivel: 1, pregunta: '¿p?', respuesta: 'r', ia: { fragmento: `  ${'a'.repeat(400)} ` } }])
  assert.equal(t.ia?.fragmento?.length, 282)
})

test('paraGuardar: cada tarjeta con su origen (archivo, página, rama del mapa y fragmento)', () => {
  const lista = borradores([
    { tema: 'ACG', nivel: 1, pregunta: '¿Edad?', respuesta: '>50 años', ia: { pagina: 4, fragmento: 'Mayores de 50 años.' } },
    { tema: 'ACG', nivel: 3, pregunta: '¿Dosis?', respuesta: '1 mg/kg', ia: { diapositiva: 7 } },
    { tema: 'ACG', nivel: 2, pregunta: '¿Sin origen?', respuesta: 'r' },
  ])
  const [a, b, c] = paraGuardar(lista, { nombre: 'Clase.pptx', unidad: 'diapositiva', mapId: 'm1', nodeId: 'n7' })
  assert.deepEqual(a.source, { name: 'Clase.pptx', page: 4, unit: 'diapositiva', mapId: 'm1', nodeId: 'n7', snippet: 'Mayores de 50 años.' })
  assert.deepEqual(b.source, { name: 'Clase.pptx', page: 7, unit: 'diapositiva', mapId: 'm1', nodeId: 'n7' })
  assert.deepEqual(c.source, { name: 'Clase.pptx', mapId: 'm1', nodeId: 'n7' })
  assert.equal(paraGuardar(lista)[2].source, undefined, 'sin nada que decir, sin source')
})

test('nivelesParaEmpezar y leerNivelesURL', () => {
  assert.deepEqual(nivelesParaEmpezar([{ nivel: 4, incluir: true }, { nivel: 2, incluir: true }, { nivel: 1, incluir: false }, { nivel: 3, incluir: true }]), [2, 3])
  assert.deepEqual(nivelesParaEmpezar([{ nivel: 4, incluir: true }]), [4])
  assert.deepEqual(leerNivelesURL('2,1,1'), [1, 2])
  assert.deepEqual(leerNivelesURL('4'), [4])
  assert.equal(leerNivelesURL('9,x'), null)
  assert.equal(leerNivelesURL(null), null)
})
