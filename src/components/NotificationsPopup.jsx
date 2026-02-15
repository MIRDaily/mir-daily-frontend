'use client'

import { useRouter } from 'next/navigation'
import { formatNotificationTime, resolveNotificationIcon } from '@/service/api/notifications'
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed'
import { useNotificationsContext } from '@/providers/NotificationsProvider'

export default function NotificationsPopup({ open, onClose }) {
  const router = useRouter()
  const {
    items,
    loading,
    refreshing,
    error,
    refresh,
    markOneAsRead,
  } = useNotificationsFeed({
    filter: 'all',
    limit: 10,
    enabled: open,
  })
  const { refreshUnreadCount, decrementUnread } = useNotificationsContext()

  const handleOpenItem = async (item) => {
    if (item.unread) {
      const ok = await markOneAsRead(item.id)
      if (ok) {
        decrementUnread()
      } else {
        refreshUnreadCount({ debounced: true })
      }
    }

    onClose()
    if (item.actionUrl) {
      router.push(item.actionUrl)
      return
    }
    refreshUnreadCount({ debounced: true })
  }

  return (
    <div
      className={`absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-[0_18px_40px_rgba(125,138,150,0.18)] border border-[#7D8A96]/10 origin-top-right transition-all duration-250 z-50 ${
        open
          ? 'opacity-100 translate-y-0 visible'
          : 'opacity-0 translate-y-2 invisible pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#7D8A96]/10">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#2D3748]">Notificaciones</h3>
          {(loading || refreshing) && (
            <div className="flex items-center gap-1" aria-label="Actualizando notificaciones">
              <span className="size-1.5 rounded-full bg-[#C45B4B]/70 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-[#C45B4B]/70 animate-bounce [animation-delay:120ms]" />
              <span className="size-1.5 rounded-full bg-[#C45B4B]/70 animate-bounce [animation-delay:240ms]" />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-4 space-y-3">
          <div className="h-10 rounded-xl bg-[#F5F1EE] animate-pulse" />
          <div className="h-10 rounded-xl bg-[#F5F1EE] animate-pulse" />
          <div className="h-10 rounded-xl bg-[#F5F1EE] animate-pulse" />
        </div>
      ) : error ? (
        <div className="px-4 py-4">
          <p className="text-xs text-[#C4655A]">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 text-xs font-semibold text-[#C45B4B]"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto py-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void handleOpenItem(item)}
                className="w-full text-left px-4 py-3 hover:bg-[#FAF7F4] transition-colors flex gap-3"
              >
                <div className={`mt-0.5 size-8 rounded-xl flex items-center justify-center ${
                  item.unread
                    ? 'bg-[#FFF1EE] text-[#C4655A]'
                    : 'bg-[#F3F4F6] text-[#7D8A96]'
                }`}>
                        <span className="material-symbols-outlined text-[18px]">
                          {resolveNotificationIcon(item)}
                        </span>
                      </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#374151] truncate">
                      {item.title}
                    </p>
                    {item.unread && (
                      <span className="size-1.5 rounded-full bg-[#E8A598] shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-[#7D8A96] mt-1 leading-relaxed line-clamp-2">
                    {item.body}
                  </p>
                  <p className="text-[11px] text-[#A0A9B2] mt-1">
                    {formatNotificationTime(item.createdAt)}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {!items.length && (
            <li className="px-4 py-5 text-xs text-[#7D8A96]">
              No tienes notificaciones por ahora.
            </li>
          )}
        </ul>
      )}

      <div className="px-4 py-3 border-t border-[#7D8A96]/10 bg-[#FCFBFA] rounded-b-2xl">
        <button
          type="button"
          onClick={() => {
            onClose()
            router.push('/notifications')
          }}
          className="text-xs font-semibold text-[#C45B4B] hover:text-[#A24C43]"
        >
          Ver todas
        </button>
      </div>
    </div>
  )
}
