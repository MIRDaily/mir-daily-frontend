import { LEVEL_INFO, type FlashcardLevel } from '@/lib/studioFlashcards'

// Insignia del nivel de dificultad de una tarjeta (fácil, media, difícil, demencial): vista previa
// de la IA, lista de tarjetas del grupo y estudio.
export function NivelBadge({ nivel, size = 'sm' }: { nivel: FlashcardLevel; size?: 'sm' | 'md' }) {
  const info = LEVEL_INFO[nivel]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold ${size === 'md' ? 'px-2.5 py-1 text-[0.75rem]' : 'px-2 py-0.5 text-[0.68rem]'}`}
      style={{ background: info.soft, color: info.color, border: `1.5px solid ${info.color}` }}
      title={`Nivel ${nivel}: ${info.name.toLowerCase()}`}
    >
      <span aria-hidden className="inline-flex gap-[2px]">
        {[1, 2, 3, 4].map((k) => (
          <span key={k} className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: k <= nivel ? info.color : `${info.color}33` }} />
        ))}
      </span>
      {info.name}
    </span>
  )
}
