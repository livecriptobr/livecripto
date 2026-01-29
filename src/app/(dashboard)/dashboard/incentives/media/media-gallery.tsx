'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'

interface MediaDonation {
  id: string
  donorName: string
  message: string
  amountCents: number
  currency: string
  mediaUrl: string | null
  mediaType: string | null
  createdAt: string
  paidAt: string | null
}

interface MediaResponse {
  donations: MediaDonation[]
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
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function MediaGallery() {
  const [page, setPage] = useState(1)
  const [mediaType, setMediaType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modalItem, setModalItem] = useState<MediaDonation | null>(null)
  const limit = 24

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    if (mediaType) params.set('mediaType', mediaType)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    return `/api/private/media?${params.toString()}`
  }, [page, mediaType, dateFrom, dateTo])

  const { data, isLoading, error } = useSWR<MediaResponse>(buildUrl(), fetcher)

  if (error) {
    return <p className="text-red-400">Erro ao carregar mídia.</p>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Tipo</label>
          <select
            value={mediaType}
            onChange={(e) => { setMediaType(e.target.value); setPage(1) }}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Todos</option>
            <option value="gif">GIF</option>
            <option value="image">Imagem</option>
          </select>
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
      </div>

      {/* Gallery */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-8">Carregando...</div>
      ) : !data || data.donations.length === 0 ? (
        <div className="text-zinc-400 text-center py-8">Nenhuma mídia encontrada.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.donations.map((d) => (
              <div
                key={d.id}
                onClick={() => setModalItem(d)}
                className="cursor-pointer group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-violet-600 transition-colors"
              >
                <div className="aspect-square overflow-hidden bg-zinc-800 flex items-center justify-center">
                  {d.mediaUrl ? (
                    <img
                      src={d.mediaUrl}
                      alt={`Mídia de ${d.donorName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span className="text-zinc-600">Sem imagem</span>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-100 truncate">
                      {d.donorName}
                    </span>
                    <span className="text-sm font-medium text-green-400 whitespace-nowrap ml-2">
                      {formatBRL(d.amountCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{formatDate(d.createdAt)}</span>
                    {d.mediaType && (
                      <span className="text-xs uppercase text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {d.mediaType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>
              {data.total} mídia{data.total !== 1 ? 's' : ''} — Página {data.page} de {data.totalPages}
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

      {/* Modal */}
      {modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalItem(null)}
        >
          <div
            className="max-w-2xl w-full rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-zinc-100">{modalItem.donorName}</p>
                <p className="text-sm text-zinc-400">
                  {formatDate(modalItem.createdAt)} — {formatBRL(modalItem.amountCents)}
                </p>
              </div>
              <button
                onClick={() => setModalItem(null)}
                className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            {modalItem.mediaUrl && (
              <div className="flex justify-center">
                <img
                  src={modalItem.mediaUrl}
                  alt="Mídia"
                  className="max-h-[60vh] rounded-lg object-contain"
                />
              </div>
            )}
            {modalItem.message && (
              <p className="text-zinc-300 whitespace-pre-wrap">{modalItem.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
