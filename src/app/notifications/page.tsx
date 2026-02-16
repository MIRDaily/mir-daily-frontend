'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed'
import { formatNotificationTime, resolveNotificationIcon } from '@/service/api/notifications'
import { useNotificationsContext } from '@/providers/NotificationsProvider'

type PageNotificationsFilter = 'all' | 'unread'

export default function NotificationsPage() {
  const [filter, setFilter] = useState<PageNotificationsFilter>('all')
  const {
    items,
    nextCursor,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
    markOneAsRead,
    markAllAsRead,
    unreadInView,
  } = useNotificationsFeed({
    filter,
    limit: 20,
    enabled: true,
  })
  const { refreshUnreadCount, decrementUnread, clearUnread } = useNotificationsContext()

  const titleByFilter = useMemo(
    () => ({
      all: 'Todas',
      unread: 'No leidas',
    }),
    [],
  )

  const handleMarkOneAsRead = async (id: string, unread?: boolean) => {
    if (!unread) return
    const ok = await markOneAsRead(id)
    if (ok) {
      decrementUnread()
      refreshUnreadCount({ debounced: true })
      return
    }
    refreshUnreadCount({ debounced: false })
  }

  const handleMarkAllAsRead = async () => {
    const ok = await markAllAsRead()
    if (ok) {
      if (filter === 'all' || filter === 'unread') {
        clearUnread()
      } else {
        refreshUnreadCount({ debounced: true })
      }
      return
    }
    refreshUnreadCount({ debounced: false })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#2D3748]">
      <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[#E8A598]/15 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-[#7D8A96]/10 blur-3xl" />

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <section className="bg-white/90 border border-white/60 ring-1 ring-white/70 rounded-3xl p-6 sm:p-8 shadow-[0_18px_40px_rgba(125,138,150,0.16)]">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#C45B4B] font-semibold">
                Centro de avisos
              </p>
              <h1 className="text-3xl font-bold text-[#2D3748] mt-2">Notificaciones</h1>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-[#7D8A96] text-sm">
                  Vista actual: {titleByFilter[filter]} ({unreadInView} no leidas)
                </p>
                {(loading || refreshing) && (
                  <div className="flex items-center gap-1" aria-label="Actualizando notificaciones">
                    <span className="size-1.5 rounded-full bg-[#C45B4B]/70 animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-[#C45B4B]/70 animate-bounce [animation-delay:120ms]" />
                    <span className="size-1.5 rounded-full bg-[#C45B4B]/70 animate-bounce [animation-delay:240ms]" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-xl bg-[#F5F1EE] p-1 gap-1">
                {(['all', 'unread'] as PageNotificationsFilter[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`relative px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      filter === tab ? 'text-[#C45B4B]' : 'text-[#7D8A96]'
                    }`}
                  >
                    {filter === tab && (
                      <motion.span
                        layoutId="notificationsFilterPill"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{titleByFilter[tab]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                className="text-xs font-semibold text-[#C45B4B] hover:text-[#A24C43]"
              >
                Marcar todo como leido
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              <div className="h-14 rounded-xl bg-[#F5F1EE] animate-pulse" />
              <div className="h-14 rounded-xl bg-[#F5F1EE] animate-pulse" />
              <div className="h-14 rounded-xl bg-[#F5F1EE] animate-pulse" />
            </div>
          ) : error ? (
            <div className="mt-6 rounded-xl border border-[#F4D8D4] bg-[#FFF7F6] p-4">
              <p className="text-sm text-[#C4655A]">{error}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-2 text-xs font-semibold text-[#C45B4B]"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.ul
                key={filter}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="mt-6 divide-y divide-[#EEE8E4]"
              >
                {items.map((item, index) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: index * 0.03 }}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex gap-4">
                      <div className={`mt-0.5 size-10 rounded-xl flex items-center justify-center ${
                        item.unread ? 'bg-[#FFF1EE] text-[#C4655A]' : 'bg-[#F3F4F6] text-[#7D8A96]'
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">
                          {resolveNotificationIcon(item)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm sm:text-base font-semibold text-[#374151]">
                            {item.title}
                          </h2>
                          {item.unread && <span className="size-1.5 rounded-full bg-[#E8A598] shrink-0" />}
                        </div>
                        <p className="text-sm text-[#7D8A96] mt-1 leading-relaxed">{item.body}</p>
                        {(item.metricValue != null || item.metricUnit) && (
                          <p className="text-xs text-[#7D8A96] mt-1">
                            {item.metricValue ?? ''} {item.metricUnit ?? ''}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <p className="text-xs text-[#A0A9B2]">{formatNotificationTime(item.createdAt)}</p>
                          {item.unread && (
                            <button
                              type="button"
                              onClick={() => void handleMarkOneAsRead(item.id, item.unread)}
                              className="text-xs font-semibold text-[#C45B4B] hover:text-[#A24C43]"
                            >
                              Marcar leida
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
                {!items.length && (
                  <li className="py-8 text-sm text-[#7D8A96] text-center">
                    No hay notificaciones para este filtro.
                  </li>
                )}
              </motion.ul>
            </AnimatePresence>
          )}

          {nextCursor && !loading && !error && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E8A598] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
              >
                {loadingMore ? 'Cargando...' : 'Cargar mas'}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
