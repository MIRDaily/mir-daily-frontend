'use client'

import { useId, useState } from 'react'
import { ajustarTrasEditar, errorHuecos, MAX_TEMA, MAX_TEXTO, MIN_TEXTO, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import { INK, NivelNuevo, ParrafoHuecos } from './ParrafoHuecos'

// Editar un párrafo: el texto (los huecos se recolocan solos mientras se escribe; los de la parte
// cambiada que ya no se encuentran se pierden y se avisa), los huecos (tocando palabras o seleccionando)
// y el tema. Lo usan la vista previa, la lista del grupo, «Escribir un párrafo» y el estudio. Ctrl+Enter
// guarda; Esc cancela.

export function EditorParrafo({
  inicial,
  temas = [],
  onGuardar,
  onCancelar,
  guardando = false,
  textoBoton = 'Guardar',
}: {
  inicial: { texto: string; huecos: Hueco[]; tema: string }
  /** Temas que ya hay (para elegir con la lista del navegador). */
  temas?: string[]
  onGuardar: (p: { texto: string; huecos: Hueco[]; tema: string }) => void
  onCancelar: () => void
  guardando?: boolean
  textoBoton?: string
}) {
  const [texto, setTexto] = useState(inicial.texto)
  const [huecos, setHuecos] = useState<Hueco[]>(inicial.huecos)
  const [tema, setTema] = useState(inicial.tema)
  const [nivel, setNivel] = useState<Nivel>(2)
  const [perdidos, setPerdidos] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const idLista = useId()

  const cambiarTexto = (nuevo: string) => {
    const r = ajustarTrasEditar(texto, nuevo, huecos)
    setTexto(nuevo)
    setHuecos(r.huecos)
    if (r.perdidos) setPerdidos((n) => n + r.perdidos)
  }

  const largo = texto.trim().length
  const error =
    largo < MIN_TEXTO ? `El párrafo es demasiado corto (mínimo ${MIN_TEXTO} caracteres)` : largo > MAX_TEXTO ? `El párrafo es demasiado largo (máximo ${MAX_TEXTO})` : errorHuecos(texto, huecos)

  const guardar = () => {
    if (error || guardando) return
    onGuardar({ texto, huecos, tema: tema.trim() })
  }

  return (
    <div
      className="rounded-2xl bg-white p-3"
      style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          e.stopPropagation()
          guardar()
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          onCancelar()
        }
      }}
    >
      <label className="block text-[0.68rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">
        Tema
        <input
          value={tema}
          list={idLista}
          maxLength={MAX_TEMA}
          onChange={(e) => setTema(e.target.value)}
          placeholder="La enfermedad o el bloque"
          className="mt-1 block w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-1.5 text-sm font-semibold normal-case tracking-normal text-[#2C3E50] outline-none focus:border-[#E8A598]"
        />
        <datalist id={idLista}>
          {temas.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="mt-3 block text-[0.68rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">
        Texto
        <textarea
          value={texto}
          autoFocus
          maxLength={MAX_TEXTO + 200}
          onChange={(e) => cambiarTexto(e.target.value)}
          rows={4}
          className="mt-1 block w-full resize-y rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm normal-case leading-relaxed tracking-normal text-[#2C3E50] outline-none focus:border-[#E8A598]"
        />
      </label>
      <p className="mt-1 text-right text-[0.68rem] text-[#7D8A96]">
        {largo} / {MAX_TEXTO}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">Huecos · toca una palabra o selecciona un trozo</p>
        <NivelNuevo nivel={nivel} onChange={setNivel} />
      </div>
      <div className="mt-1 rounded-xl bg-[#FAF7F4] px-3 py-2">
        <ParrafoHuecos texto={texto} huecos={huecos} onChange={setHuecos} nivel={nivel} editable onAviso={setAviso} />
      </div>
      {perdidos > 0 && (
        <p className="mt-2 text-xs font-semibold text-[#8A6418]">
          Al cambiar el texto se {perdidos === 1 ? 'ha perdido 1 hueco' : `han perdido ${perdidos} huecos`}: vuelve a marcarlo si hace falta.
        </p>
      )}
      {(error || aviso) && <p className="mt-2 text-xs font-bold text-[#B04A5E]">{error ?? aviso}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-xl px-3 py-1.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!!error || guardando}
          className="rounded-xl bg-[#E8A598] px-4 py-1.5 text-sm font-extrabold text-white disabled:opacity-50"
          style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
        >
          {guardando ? 'Guardando…' : textoBoton}
        </button>
      </div>
    </div>
  )
}
