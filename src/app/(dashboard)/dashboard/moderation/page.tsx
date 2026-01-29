'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, ChevronDown, ChevronUp, Unlock, Shield, Users, Filter } from 'lucide-react'

// --- Types ---

interface ModerationLogEntry {
  id: string
  donorName: string
  donorIpHash: string | null
  content: string
  contentType: string
  reason: string
  category: string | null
  action: string
  details: Record<string, unknown> | null
  createdAt: string
}

interface BlockedDonorEntry {
  id: string
  donorIpHash: string
  donorName: string | null
  reason: string | null
  blockedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    blocked_word: 'Palavra bloqueada',
    blocked_regex: 'Regex',
    profanity: 'Palavrao',
    gpt_moderation: 'IA',
    blocked_donor: 'Doador bloqueado',
  }
  return map[reason] || reason
}

function reasonColor(reason: string): string {
  const map: Record<string, string> = {
    blocked_word: 'bg-yellow-500/20 text-yellow-400',
    blocked_regex: 'bg-orange-500/20 text-orange-400',
    profanity: 'bg-red-500/20 text-red-400',
    gpt_moderation: 'bg-purple-500/20 text-purple-400',
    blocked_donor: 'bg-zinc-500/20 text-zinc-400',
  }
  return map[reason] || 'bg-zinc-500/20 text-zinc-400'
}

function typeBadge(contentType: string): string {
  const map: Record<string, string> = {
    text: 'bg-blue-500/20 text-blue-400',
    audio: 'bg-green-500/20 text-green-400',
    image: 'bg-pink-500/20 text-pink-400',
  }
  return map[contentType] || 'bg-zinc-500/20 text-zinc-400'
}

// --- Components ---

function LogRow({ entry }: { entry: ModerationLogEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-3 px-4 hover:bg-zinc-800/50 text-left text-sm"
      >
        <span className="text-zinc-500 w-32 shrink-0">{formatDate(entry.createdAt)}</span>
        <span className="w-28 shrink-0 truncate font-medium">{entry.donorName}</span>
        <span className="flex-1 truncate text-zinc-400">{entry.content}</span>
        <span className={`px-2 py-0.5 rounded text-xs ${typeBadge(entry.contentType)}`}>
          {entry.contentType}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs ${reasonColor(entry.reason)}`}>
          {reasonLabel(entry.reason)}
        </span>
        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
          {entry.action}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2 bg-zinc-800/30">
          <div className="text-sm">
            <span className="text-zinc-500">Conteudo completo: </span>
            <span className="text-zinc-300">{entry.content}</span>
          </div>
          {entry.category && (
            <div className="text-sm">
              <span className="text-zinc-500">Categoria: </span>
              <span className="text-zinc-300">{entry.category}</span>
            </div>
          )}
          {entry.donorIpHash && (
            <div className="text-sm">
              <span className="text-zinc-500">IP Hash: </span>
              <span className="text-zinc-300 font-mono text-xs">{entry.donorIpHash.slice(0, 16)}...</span>
            </div>
          )}
          {entry.details && (
            <div className="text-sm">
              <span className="text-zinc-500">Detalhes: </span>
              <pre className="text-zinc-300 text-xs mt-1 bg-zinc-900 p-2 rounded overflow-x-auto">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Tabs ---

type Tab = 'logs' | 'blocked'

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>('logs')
  const [logs, setLogs] = useState<ModerationLogEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [blockedDonors, setBlockedDonors] = useState<BlockedDonorEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterContentType, setFilterContentType] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const loadLogs = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filterContentType) params.set('contentType', filterContentType)
      if (filterReason) params.set('reason', filterReason)
      if (filterDateFrom) params.set('dateFrom', filterDateFrom)
      if (filterDateTo) params.set('dateTo', filterDateTo)

      const res = await fetch(`/api/moderation/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filterContentType, filterReason, filterDateFrom, filterDateTo])

  const loadBlocked = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/moderation/blocked-donors')
      const data = await res.json()
      setBlockedDonors(data.blockedDonors || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'logs') loadLogs()
    else loadBlocked()
  }, [tab, loadLogs, loadBlocked])

  const handleUnblock = async (id: string) => {
    try {
      await fetch(`/api/moderation/blocked-donors?id=${id}`, { method: 'DELETE' })
      loadBlocked()
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moderacao</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-1">
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors ${
            tab === 'logs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Logs de Moderacao
        </button>
        <button
          type="button"
          onClick={() => setTab('blocked')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors ${
            tab === 'blocked' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Doadores Bloqueados
          {blockedDonors.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">
              {blockedDonors.length}
            </span>
          )}
        </button>
      </div>

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>

          {showFilters && (
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
                <select
                  value={filterContentType}
                  onChange={e => setFilterContentType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="">Todos</option>
                  <option value="text">Texto</option>
                  <option value="audio">Audio</option>
                  <option value="image">Imagem</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Motivo</label>
                <select
                  value={filterReason}
                  onChange={e => setFilterReason(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="">Todos</option>
                  <option value="blocked_word">Palavra bloqueada</option>
                  <option value="blocked_regex">Regex</option>
                  <option value="profanity">Palavrao</option>
                  <option value="gpt_moderation">IA</option>
                  <option value="blocked_donor">Doador bloqueado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">De</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Ate</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                Nenhum log de moderacao encontrado
              </div>
            ) : (
              <>
                {logs.map(entry => (
                  <LogRow key={entry.id} entry={entry} />
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => loadLogs(pagination.page - 1)}
                className="px-3 py-1.5 bg-zinc-800 rounded text-sm disabled:opacity-50 hover:bg-zinc-700"
              >
                Anterior
              </button>
              <span className="text-sm text-zinc-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadLogs(pagination.page + 1)}
                className="px-3 py-1.5 bg-zinc-800 rounded text-sm disabled:opacity-50 hover:bg-zinc-700"
              >
                Proximo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Blocked donors tab */}
      {tab === 'blocked' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : blockedDonors.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              Nenhum doador bloqueado
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {blockedDonors.map(donor => (
                <div key={donor.id} className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {donor.donorName || 'Desconhecido'}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {donor.donorIpHash.slice(0, 16)}...
                    </div>
                    {donor.reason && (
                      <div className="text-xs text-zinc-400">{donor.reason}</div>
                    )}
                    <div className="text-xs text-zinc-600">{formatDate(donor.blockedAt)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(donor.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300"
                  >
                    <Unlock className="w-3 h-3" />
                    Desbloquear
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
