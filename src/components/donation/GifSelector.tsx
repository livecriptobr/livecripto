'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, Loader2, ImageIcon } from 'lucide-react'

interface GifItem {
  id: string
  url: string
  previewUrl: string
  width: number
  height: number
}

interface Props {
  onSelect: (gif: GifItem) => void
  onRemove: () => void
  selectedGif?: GifItem | null
}

export default function GifSelector({ onSelect, onRemove, selectedGif }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GifItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(q)}&limit=20`)
      if (!res.ok) throw new Error('Erro ao buscar GIFs')
      const data: GifItem[] = await res.json()
      setResults(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchGifs(query)
    }, 400)
    return () => clearTimeout(timer)
  }, [query, searchGifs])

  if (selectedGif) {
    return (
      <div className="space-y-2">
        <label className="block text-sm text-zinc-400">GIF selecionado</label>
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedGif.previewUrl}
            alt="GIF selecionado"
            className="rounded-lg max-h-32 border border-zinc-700"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm text-zinc-400">Adicionar GIF</label>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:border-purple-500 transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
          Escolher GIF
        </button>
      ) : (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar GIF..."
                className="bg-transparent text-white text-sm flex-1 outline-none"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
              className="p-2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
              {results.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onSelect(gif)
                    setOpen(false)
                    setQuery('')
                    setResults([])
                  }}
                  className="rounded-lg overflow-hidden border border-zinc-700 hover:border-purple-500 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.previewUrl}
                    alt="GIF"
                    className="w-full h-20 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-2">Nenhum GIF encontrado</p>
          )}
        </div>
      )}
    </div>
  )
}
