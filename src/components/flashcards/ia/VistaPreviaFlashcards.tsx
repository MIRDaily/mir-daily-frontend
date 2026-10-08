'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseBrowser'
import {
  createFlashcardDeck,
  createFlashcardsBulk,
  fetchFlashcardDecks,
  FLASHCARD_LEVELS,
  LEVEL_INFO,
  type FlashcardDeck,
  type FlashcardLevel,
} from '@/lib/studioFlashcards'
import { DEFAULT_COLOR_KEY, DEFAULT_ICON } from '@/lib/flashcardTheme'
import { agrupar, contarNiveles, origenTexto, paraGuardar, type Borrador } from '@/lib/flashcards/ia/tarjetas'
import { NivelBadge } from './NivelBadge'

// Vista previa de las flashcards con IA (documento o rama de un mapa): por tema y, dentro, de fácil
// a demencial. Cada tarjeta se puede quitar, editar y cambiar de nivel; las dudosas de la revisión
// (dato poco anclado o lejos de su tema en el documento) van en ámbar. Luego se guardan en un grupo
// nuevo o en uno existente (sin duplicar: lo decide el backend) o, en un documento tema a tema, en
// un grupo por tema. Nada se guarda hasta pulsar «Guardar».

const INK = '#2C3E50'
const MAX_POR_GRUPO = 500

type Destino = 'nuevo' | 'existente' | 'porTema'
type Hecho = { id: string; nombre: string; creadas: number; duplicadas: number }

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Inicia sesión para guardar las flashcards.')
  return session.access_token
}

const filas = (s: string) => Math.min(4, Math.max(1, Math.ceil(s.length / 46)))

export function VistaPreviaFlashcards({
  inicial,
  nombreGrupo,
  onVolver,
  onCerrar,
}: {
  inicial: Borrador[]
  /** Nombre propuesto para un grupo nuevo. */
  nombreGrupo: string
  /** Volver a los ajustes (generar otra vez). */
  onVolver?: () => void
  onCerrar: () => void
}) {
  const [lista, setLista] = useState<Borrador[]>(inicial)
  const [soloDudosas, setSoloDudosas] = useState(false)
  // Documento tema a tema: cada borrador lleva su tema del libro (`grupo`).
  const temasLibro = new Set(inicial.map((b) => b.grupo).filter(Boolean)).size
  const porTemaDisponible = temasLibro > 1
  const [destino, setDestino] = useState<Destino>(porTemaDisponible ? 'porTema' : 'nuevo')
  const [nombre, setNombre] = useState(nombreGrupo.slice(0, 80))
  const [decks, setDecks] = useState<FlashcardDeck[] | null>(null)
  const [deckId, setDeckId] = useState('')
  const [guardando, setGuardando] = useState<{ hecho: number; total: number } | null>(null)
  const [hechos, setHechos] = useState<Hecho[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Grupos ya creados en un intento anterior (si algo falla a medias, no se crean dos veces).
  const creados = useRef(new Map<string, FlashcardDeck>())

  useEffect(() => {
    let vivo = true
    token()
      .then(fetchFlashcardDecks)
      .then((d) => vivo && setDecks(d))
      .catch(() => vivo && setDecks([]))
    return () => {
      vivo = false
    }
  }, [])

  const grupoDe = (b: Borrador) => b.grupo || nombreGrupo
  const elegidas = lista.filter((b) => b.incluir && b.pregunta.trim() && b.respuesta.trim())
  const niveles = contarNiveles(lista)
  const dudosas = lista.filter((b) => b.ia?.dudoso).length
  const secciones = useMemo(() => agrupar(lista), [lista])
  const destinoDeck = decks?.find((d) => d.id === deckId)

  // Cuántas van a cada grupo (para el tope de 500).
  const reparto = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of elegidas) m.set(destino === 'porTema' ? grupoDe(b) : nombre, (m.get(destino === 'porTema' ? grupoDe(b) : nombre) ?? 0) + 1)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegidas.length, lista, destino, nombre])
  const excede =
    destino === 'existente'
      ? !!destinoDeck && destinoDeck.totalCards + elegidas.length > MAX_POR_GRUPO
      : [...reparto.values()].some((n) => n > MAX_POR_GRUPO)
  const nombreOk = destino !== 'nuevo' || nombre.trim().length >= 3
  const puede = elegidas.length > 0 && !excede && nombreOk && (destino !== 'existente' || !!destinoDeck) && !guardando

  const cambiar = (i: number, p: Partial<Borrador>) => setLista((l) => l.map((b, k) => (k === i ? { ...b, ...p } : b)))
  const alternarNivel = (n: FlashcardLevel) => {
    const todas = lista.filter((b) => b.nivel === n).every((b) => b.incluir)
    setLista((l) => l.map((b) => (b.nivel === n ? { ...b, incluir: !todas } : b)))
  }

  const guardar = async () => {
    if (!puede) return
    setError(null)
    try {
      const tk = await token()
      // Grupos de destino y sus tarjetas, en el orden de la vista previa.
      const lotes: { nombre: string; deck?: FlashcardDeck; tarjetas: Borrador[] }[] = []
      if (destino === 'existente') lotes.push({ nombre: destinoDeck!.name, deck: destinoDeck!, tarjetas: elegidas })
      else if (destino === 'nuevo') lotes.push({ nombre: nombre.trim(), tarjetas: elegidas })
      else {
        const m = new Map<string, Borrador[]>()
        for (const b of elegidas) (m.get(grupoDe(b)) ?? m.set(grupoDe(b), []).get(grupoDe(b))!).push(b)
        for (const [n, ts] of m) lotes.push({ nombre: n, tarjetas: ts })
      }
      const total = elegidas.length
      let hecho = 0
      setGuardando({ hecho, total })
      const resultado: Hecho[] = []
      for (const lote of lotes) {
        let deck = lote.deck ?? creados.current.get(lote.nombre)
        if (!deck) {
          // El backend exige 3 caracteres y no admite dos grupos con el mismo nombre.
          const n = lote.nombre.length >= 3 ? lote.nombre.slice(0, 80) : `${lote.nombre} (IA)`
          deck = await createFlashcardDeck(tk, { name: n, color: DEFAULT_COLOR_KEY, icon: DEFAULT_ICON })
          creados.current.set(lote.nombre, deck)
        }
        const r = await createFlashcardsBulk(tk, deck.id, paraGuardar(lote.tarjetas), {
          aiGenerated: true,
          onProgress: (d) => setGuardando({ hecho: hecho + d, total }),
        })
        hecho += lote.tarjetas.length
        resultado.push({ id: deck.id, nombre: deck.name, creadas: r.created, duplicadas: r.duplicates })
      }
      setHechos(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar las flashcards')
    } finally {
      setGuardando(null)
    }
  }

  if (hechos) {
    const creadas = hechos.reduce((n, h) => n + h.creadas, 0)
    const duplicadas = hechos.reduce((n, h) => n + h.duplicadas, 0)
    return (
      <div className="px-6 pb-6">
        <div className="rounded-2xl bg-white px-4 py-4" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
          <p className="flex items-center gap-2 text-base font-extrabold text-[#2C3E50]">
            <span aria-hidden className="inline-block text-[#8BA888]">
              <span className="material-symbols-outlined text-[1.4rem] leading-none">task_alt</span>
            </span>
            {creadas} {creadas === 1 ? 'flashcard guardada' : 'flashcards guardadas'}
          </p>
          {duplicadas > 0 && (
            <p className="mt-1 text-[0.8rem] text-[#7D8A96]">
              {duplicadas} ya {duplicadas === 1 ? 'estaba' : 'estaban'} en el grupo y no se {duplicadas === 1 ? 'ha' : 'han'} repetido.
            </p>
          )}
          <ul className="mt-3 max-h-[14rem] space-y-1 overflow-y-auto">
            {hechos.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/flashcards/${h.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[0.82rem] font-bold text-[#2C3E50] hover:bg-[#FAF7F4]"
                >
                  <span className="min-w-0 truncate">{h.nombre}</span>
                  <span className="shrink-0 text-[0.72rem] font-semibold text-[#7D8A96]">{h.creadas} tarjetas</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          {hechos.length === 1 && (
            <Link
              href={`/flashcards/${hechos[0].id}`}
              className="rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              Abrir el grupo
            </Link>
          )}
          <button type="button" onClick={onCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-y-auto px-6 pb-4">
        {error && (
          <div role="alert" className="mb-3 rounded-2xl border border-[#D4667A]/30 bg-[#FAEAED] px-4 py-3 text-sm font-medium text-[#B04A5E]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-[#2C3E50]">
            {elegidas.length} de {lista.length} tarjetas · {secciones.length} {secciones.length === 1 ? 'tema' : 'temas'}
          </span>
          <span className="rounded-full bg-[#2C3E50] px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-white">Generado por IA</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Incluir por nivel">
          {FLASHCARD_LEVELS.map((n) => {
            const total = lista.filter((b) => b.nivel === n).length
            if (!total) return null
            const on = lista.filter((b) => b.nivel === n).some((b) => b.incluir)
            return (
              <button
                key={n}
                type="button"
                onClick={() => alternarNivel(n)}
                aria-pressed={on}
                title={on ? `Quitar todas las de nivel ${LEVEL_INFO[n].name.toLowerCase()}` : `Volver a incluir las de nivel ${LEVEL_INFO[n].name.toLowerCase()}`}
                className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold"
                style={{
                  border: `1.5px solid ${on ? LEVEL_INFO[n].color : '#D4C8BE'}`,
                  background: on ? LEVEL_INFO[n].soft : '#FFFFFF',
                  color: on ? LEVEL_INFO[n].color : '#7D8A96',
                  textDecoration: on ? undefined : 'line-through',
                }}
              >
                {LEVEL_INFO[n].name} · {niveles[n]}/{total}
              </button>
            )
          })}
          {dudosas > 0 && (
            <button
              type="button"
              onClick={() => setSoloDudosas((v) => !v)}
              aria-pressed={soloDudosas}
              className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold"
              style={{ border: '1.5px solid #D9A441', background: soloDudosas ? '#D9A441' : '#FBF3E1', color: soloDudosas ? '#FFFFFF' : '#8A6418' }}
            >
              {soloDudosas ? 'Ver todas' : `Revisar ${dudosas} ${dudosas === 1 ? 'dudosa' : 'dudosas'}`}
            </button>
          )}
        </div>
        <p className="mt-2 text-[0.75rem] text-[#7D8A96]">
          La IA puede equivocarse. Las de borde ámbar tienen un dato que el documento no dice igual o lejos de su tema: revísalas.
        </p>

        <div className="mt-3 space-y-4">
          {secciones.map((s) => {
            const visibles = s.niveles
              .map((g) => ({ ...g, indices: soloDudosas ? g.indices.filter((i) => lista[i].ia?.dudoso) : g.indices }))
              .filter((g) => g.indices.length)
            if (!visibles.length) return null
            return (
              <section key={s.tema}>
                <h3 className="mb-1.5 text-[0.8rem] font-extrabold uppercase tracking-wide text-[#2C3E50]">{s.tema}</h3>
                <div className="space-y-1.5">
                  {visibles.flatMap((g) =>
                    g.indices.map((i) => <FilaTarjeta key={lista[i].key} b={lista[i]} onCambio={(p) => cambiar(i, p)} bloqueada={!!guardando} />),
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dónde guardarlas">
          {(
            [
              ...(porTemaDisponible ? [['porTema', `Un grupo por tema (${temasLibro})`] as const] : []),
              ['nuevo', 'Grupo nuevo'] as const,
              ['existente', 'Añadir a un grupo'] as const,
            ] as const
          ).map(([id, txt]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={destino === id}
              disabled={!!guardando || (id === 'existente' && !decks?.length)}
              onClick={() => setDestino(id)}
              className="rounded-xl px-3 py-1.5 text-xs font-extrabold disabled:opacity-40"
              style={{ border: `2px solid ${destino === id ? '#E8A598' : '#EDE6DE'}`, color: destino === id ? '#2C3E50' : '#7D8A96', background: '#FFFFFF' }}
            >
              {id === 'existente' && decks === null ? 'Cargando grupos…' : txt}
            </button>
          ))}
        </div>
        <div className="mt-2">
          {destino === 'nuevo' && (
            <input
              value={nombre}
              disabled={!!guardando}
              maxLength={80}
              onChange={(e) => setNombre(e.target.value)}
              aria-label="Nombre del grupo nuevo"
              className="w-full rounded-xl border border-[#7D8A96]/25 bg-white px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
            />
          )}
          {destino === 'existente' && (
            <select
              value={deckId}
              disabled={!!guardando}
              onChange={(e) => setDeckId(e.target.value)}
              aria-label="Grupo de destino"
              className="w-full rounded-xl border border-[#7D8A96]/25 bg-white px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
            >
              <option value="">Elige un grupo…</option>
              {(decks ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.totalCards})
                </option>
              ))}
            </select>
          )}
          {destino === 'porTema' && (
            <p className="text-xs text-[#7D8A96]">Cada tema del documento, en su propio grupo con su nombre.</p>
          )}
          {!nombreOk && <p className="mt-1 text-xs font-bold text-[#B04A5E]">El nombre necesita al menos 3 caracteres.</p>}
          {excede && <p className="mt-1 text-xs font-bold text-[#B04A5E]">Un grupo admite como mucho {MAX_POR_GRUPO} tarjetas: quita algunas o guárdalas por temas.</p>}
          {destino === 'existente' && destinoDeck && (
            <p className="mt-1 text-xs text-[#7D8A96]">Las que ya estén en «{destinoDeck.name}» con el mismo anverso y reverso no se repiten.</p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-end gap-3">
          {guardando && (
            <span role="status" className="mr-auto text-xs font-bold text-[#7D8A96]">
              Guardando {guardando.hecho} de {guardando.total}…
            </span>
          )}
          {onVolver && (
            <button type="button" onClick={onVolver} disabled={!!guardando} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50] disabled:opacity-40">
              Volver a generar
            </button>
          )}
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!puede}
            className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
          >
            <span aria-hidden className="inline-block">
              <span className="material-symbols-outlined text-[1.1rem] leading-none">style</span>
            </span>
            {creados.current.size ? 'Reintentar' : `Guardar ${elegidas.length} ${elegidas.length === 1 ? 'flashcard' : 'flashcards'}`}
          </button>
        </div>
      </footer>
    </>
  )
}

function FilaTarjeta({ b, onCambio, bloqueada }: { b: Borrador; onCambio: (p: Partial<Borrador>) => void; bloqueada: boolean }) {
  const origen = origenTexto(b.ia)
  const campo = 'w-full resize-y rounded-lg border border-[#7D8A96]/20 bg-white px-2 py-1 text-[0.82rem] leading-snug text-[#2C3E50] outline-none focus:border-[#E8A598]'
  return (
    <div
      className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-xl bg-white p-2 sm:grid-cols-[auto_1fr_1fr]"
      style={{ border: `1.5px solid ${b.ia?.dudoso ? '#D9A441' : b.incluir ? INK : '#E5DED6'}`, opacity: b.incluir ? 1 : 0.55 }}
    >
      <input
        type="checkbox"
        checked={b.incluir}
        disabled={bloqueada}
        onChange={(e) => onCambio({ incluir: e.target.checked })}
        aria-label="Incluir esta tarjeta"
        style={{ accentColor: '#E8A598', width: 16, height: 16, marginTop: 6 }}
      />
      <textarea
        value={b.pregunta}
        disabled={bloqueada}
        rows={filas(b.pregunta)}
        maxLength={300}
        onChange={(e) => onCambio({ pregunta: e.target.value })}
        aria-label="Pregunta (anverso)"
        className={`${campo} font-bold`}
      />
      <textarea
        value={b.respuesta}
        disabled={bloqueada}
        rows={filas(b.respuesta)}
        maxLength={200}
        onChange={(e) => onCambio({ respuesta: e.target.value })}
        aria-label="Respuesta (reverso)"
        className={`${campo} col-start-2 sm:col-start-auto`}
      />
      <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-span-2">
        <NivelBadge nivel={b.nivel} />
        <select
          value={b.nivel}
          disabled={bloqueada}
          onChange={(e) => onCambio({ nivel: Number(e.target.value) as FlashcardLevel })}
          aria-label="Cambiar el nivel"
          className="rounded-md border border-[#7D8A96]/25 bg-white px-1 py-0.5 text-[0.7rem] font-bold text-[#7D8A96]"
        >
          {FLASHCARD_LEVELS.map((n) => (
            <option key={n} value={n}>
              {LEVEL_INFO[n].name}
            </option>
          ))}
        </select>
        {origen && <span className="text-[0.7rem] font-semibold text-[#7D8A96]">{origen}</span>}
        {b.ia?.dudoso && (
          <span className="rounded-full bg-[#FBF3E1] px-2 py-0.5 text-[0.68rem] font-extrabold text-[#8A6418]">
            {b.ia.dudoso === 'tratamiento' ? 'Revisa: tratamiento lejos de su tema' : 'Revisa: el documento no lo dice igual'}
          </span>
        )}
      </div>
    </div>
  )
}
