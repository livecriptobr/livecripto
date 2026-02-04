'use client'

import { useState, useCallback, useRef } from 'react'
import useSWR from 'swr'
import { RotateCcw, Loader2, Check } from 'lucide-react'

interface DonationMessage {
  id: string
  donorName: string
  message: string
  amountCents: number
  currency: string
  voiceMessageUrl: string | null
  mediaUrl: string | null
  mediaType: string | null
  createdAt: string
  paidAt: string | null
}

interface MessagesResponse {
  donations: DonationMessage[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessagesInbox() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [hasVoice, setHasVoice] = useState(false)
  const [hasMedia, setHasMedia] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const limit = 20

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    if (search) params.set('search', search)
    if (hasVoice) params.set('hasVoice', 'true')
    if (hasMedia) params.set('hasMedia', 'true')
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    return `/api/private/messages?${params.toString()}`
  }, [page, search, hasVoice, hasMedia, dateFrom, dateTo])

  const { data, isLoading, error } = useSWR<MessagesResponse>(buildUrl(), fetcher)

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  if (error) {
    return <p className="text-red-400">Erro ao carregar mensagens.</p>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-zinc-400 mb-1">Buscar</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome do doador ou mensagem..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={handleSearch}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              Buscar
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hasVoice}
            onChange={(e) => { setHasVoice(e.target.checked); setPage(1) }}
            className="accent-violet-500"
          />
          Com voz
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hasMedia}
            onChange={(e) => { setHasMedia(e.target.checked); setPage(1) }}
            className="accent-violet-500"
          />
          Com mídia
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-8">Carregando...</div>
      ) : !data || data.donations.length === 0 ? (
        <div className="text-zinc-400 text-center py-8">Nenhuma mensagem encontrada.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Doador</th>
                  <th className="px-4 py-3 text-left font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium">Mensagem</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.donations.map((d) => (
                  <MessageRow
                    key={d.id}
                    donation={d}
                    isExpanded={expandedId === d.id}
                    onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>
              {data.total} mensagem{data.total !== 1 ? 's' : ''} — Página {data.page} de {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-zinc-700"
              >
                Anterior
              </button>
              <button
                disabled={page >= (data.totalPages || 1)}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-zinc-700"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MessageRow({
  donation,
  isExpanded,
  onToggle,
}: {
  donation: DonationMessage
  isExpanded: boolean
  onToggle: () => void
}) {
  const [replayState, setReplayState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleReplay = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (replayState === 'loading') return

    setReplayState('loading')
    try {
      const res = await fetch('/api/private/alerts/replay-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId: donation.id }),
      })
      if (!res.ok) throw new Error()
      setReplayState('done')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setReplayState('idle'), 3000)
    } catch {
      setReplayState('error')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setReplayState('idle'), 3000)
    }
  }

  const truncatedMsg =
    donation.message.length > 60
      ? donation.message.slice(0, 60) + '...'
      : donation.message

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-zinc-800/50 transition-colors"
      >
        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
          {formatDate(donation.createdAt)}
        </td>
        <td className="px-4 py-3 text-zinc-100 font-medium">
          {donation.donorName}
        </td>
        <td className="px-4 py-3 text-green-400 font-medium whitespace-nowrap">
          {formatBRL(donation.amountCents)}
        </td>
        <td className="px-4 py-3 text-zinc-300">
          {isExpanded ? '' : truncatedMsg}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            {donation.voiceMessageUrl && (
              <span title="Mensagem de voz" className="text-base">🎤</span>
            )}
            {donation.mediaUrl && (
              <span title="Mídia anexada" className="text-base">🖼️</span>
            )}
            {!donation.voiceMessageUrl && !donation.mediaUrl && (
              <span className="text-zinc-600">—</span>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-zinc-900/80">
          <td colSpan={5} className="px-4 py-4 space-y-3">
            <p className="text-zinc-200 whitespace-pre-wrap">{donation.message}</p>
            {donation.voiceMessageUrl && (
              <div>
                <p className="text-xs text-zinc-400 mb-1">Mensagem de voz:</p>
                <audio controls src={donation.voiceMessageUrl} className="w-full max-w-md" />
              </div>
            )}
            {donation.mediaUrl && (
              <div>
                <p className="text-xs text-zinc-400 mb-1">Mídia:</p>
                {donation.mediaType?.startsWith('video') ? (
                  <video
                    controls
                    src={donation.mediaUrl}
                    className="max-w-sm rounded-lg"
                  />
                ) : (
                  <img
                    src={donation.mediaUrl}
                    alt="Mídia da doação"
                    className="max-w-sm rounded-lg"
                  />
                )}
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              {donation.paidAt && (
                <p className="text-xs text-zinc-500">
                  Pago em: {formatDate(donation.paidAt)}
                </p>
              )}
              {donation.paidAt && (
                <button
                  onClick={handleReplay}
                  disabled={replayState === 'loading'}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    replayState === 'done'
                      ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                      : replayState === 'error'
                        ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                        : 'bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30'
                  }`}
                >
                  {replayState === 'loading' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                  ) : replayState === 'done' ? (
                    <><Check className="w-3.5 h-3.5" /> Enviado!</>
                  ) : replayState === 'error' ? (
                    <>Erro ao retocar</>
                  ) : (
                    <><RotateCcw className="w-3.5 h-3.5" /> Retocar</>
                  )}
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
