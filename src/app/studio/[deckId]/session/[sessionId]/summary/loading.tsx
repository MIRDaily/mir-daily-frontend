export default function StudioSessionSummaryLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        <p className="text-sm font-medium text-slate-700">Cargando resumen...</p>
      </div>
    </main>
  )
}
