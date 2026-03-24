type SubjectHeaderProps = {
  name: string
  progress: number
  topicsDone: number
  totalTopics: number
  subtitle: string
}

export default function SubjectHeader({
  name,
  progress,
  topicsDone,
  totalTopics,
  subtitle,
}: SubjectHeaderProps) {
  return (
    <section className="flex flex-col justify-between gap-6 rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm lg:flex-row">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-black text-[#2C3E50]">{name}</h1>
        <p className="text-sm text-[#7D8A96]">{subtitle}</p>

        <div className="mt-2 flex gap-6 text-sm text-[#7D8A96]">
          <span>
            <strong className="text-[#2C3E50]">{progress}%</strong> completado
          </span>
          <span>
            <strong className="text-[#2C3E50]">{topicsDone}</strong> temas hechos
          </span>
        </div>

        <div className="mt-2 h-2 w-full rounded-full bg-[#F2EFED]">
          <div className="h-2 rounded-full bg-[#8BA888]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex min-w-[200px] flex-col gap-3">
        <button
          type="button"
          className="rounded-xl bg-[#E8A598] py-3 font-medium text-white transition-colors hover:bg-[#d18d80]"
        >
          Continuar estudio
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#EAE4E2] py-3 transition-colors hover:bg-[#F9F8F7]"
        >
          Test de la asignatura
        </button>
      </div>
    </section>
  )
}

