'use client'

import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import { Bell } from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<NotificationsResponse>(
    '/api/notifications?unread=true&limit=10',
    fetcher,
    { refreshInterval: 30000 }
  )

  const unreadCount = data?.unreadCount ?? 0

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    mutate()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-white">Notificações</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-purple-400 hover:text-purple-300">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(!data?.notifications || data.notifications.length === 0) ? (
              <p className="text-sm text-zinc-500 p-4 text-center">Nenhuma notificação</p>
            ) : (
              data.notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-zinc-800/50 ${!n.isRead ? 'bg-purple-600/5' : ''}`}
                >
                  <p className="text-sm text-zinc-200">{n.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
