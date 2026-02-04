'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, BarChart3, QrCode, List, Timer, Vote, Video, Music,
  Plus, Copy, Eye, RotateCcw, Trash2, Settings, Power, X, Check,
} from 'lucide-react'

// --- Types ---

interface MarathonTimerData {
  id: string
  endsAt: string
  baseMinutes: number
  addMinutesPer: number
  addThreshold: number
  maxHours: number
  isPaused: boolean
}

interface WidgetData {
  id: string
  type: string
  name: string
  token: string
  config: Record<string, unknown>
  isActive: boolean
  createdAt: string
  marathonTimer: MarathonTimerData | null
}

interface WidgetTypeInfo {
  key: string
  label: string
  icon: React.ReactNode
  description: string
}

// --- Constants ---

const WIDGET_TYPES: WidgetTypeInfo[] = [
  { key: 'alerts', label: 'Alertas', icon: <Bell size={24} />, description: 'Mostra alertas de doacoes na tela' },
  { key: 'ranking', label: 'Ranking', icon: <BarChart3 size={24} />, description: 'Top doadores por periodo' },
  { key: 'qrcode', label: 'QR Code', icon: <QrCode size={24} />, description: 'QR Code para pagina de doacoes' },
  { key: 'recent', label: 'Recentes', icon: <List size={24} />, description: 'Lista de doacoes recentes' },
  { key: 'marathon', label: 'Maratona', icon: <Timer size={24} />, description: 'Contador regressivo de maratona' },
  { key: 'poll', label: 'Enquete', icon: <Vote size={24} />, description: 'Enquete interativa no overlay' },
  { key: 'video', label: 'Video', icon: <Video size={24} />, description: 'Fila de videos do YouTube' },
  { key: 'music', label: 'Musica', icon: <Music size={24} />, description: 'Player de musica via YouTube' },
]

function getTypeInfo(type: string): WidgetTypeInfo {
  return WIDGET_TYPES.find(t => t.key === type) ?? WIDGET_TYPES[0]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

// --- Config Editors ---

interface ConfigEditorProps {
  type: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}

function ConfigEditor({ type, config, onChange }: ConfigEditorProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  const inputClass = 'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm'
  const labelClass = 'block text-sm text-zinc-400 mb-1'

  switch (type) {
    case 'alerts':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Animacao</label>
            <select className={inputClass} value={(config.animation as string) ?? 'slideUp'} onChange={e => set('animation', e.target.value)}>
              <option value="fadeIn">Fade In</option>
              <option value="slideUp">Slide Up</option>
              <option value="bounce">Bounce</option>
              <option value="zoom">Zoom</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Duracao (segundos)</label>
            <input type="number" className={inputClass} value={(config.duration as number) ?? 5} onChange={e => set('duration', Number(e.target.value))} min={2} max={30} />
          </div>
          <div>
            <label className={labelClass}>Tamanho fonte</label>
            <input type="number" className={inputClass} value={(config.fontSize as number) ?? 24} onChange={e => set('fontSize', Number(e.target.value))} min={12} max={72} />
          </div>
          <div>
            <label className={labelClass}>Layout</label>
            <select className={inputClass} value={(config.layout as string) ?? 'vertical'} onChange={e => set('layout', e.target.value)}>
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Cor nome</label><input type="color" className="w-full h-8 cursor-pointer" value={(config.nameColor as string) ?? '#FFFFFF'} onChange={e => set('nameColor', e.target.value)} /></div>
            <div><label className={labelClass}>Cor valor</label><input type="color" className="w-full h-8 cursor-pointer" value={(config.amountColor as string) ?? '#FFD700'} onChange={e => set('amountColor', e.target.value)} /></div>
            <div><label className={labelClass}>Cor msg</label><input type="color" className="w-full h-8 cursor-pointer" value={(config.messageColor as string) ?? '#E0E0E0'} onChange={e => set('messageColor', e.target.value)} /></div>
          </div>
        </div>
      )
    case 'ranking':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Periodo</label>
            <select className={inputClass} value={(config.period as string) ?? 'alltime'} onChange={e => set('period', e.target.value)}>
              <option value="today">Hoje</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="alltime">Todos</option>
            </select>
          </div>
          <div><label className={labelClass}>Titulo</label><input className={inputClass} value={(config.title as string) ?? ''} onChange={e => set('title', e.target.value)} placeholder="Top Doadores" /></div>
          <div><label className={labelClass}>Tamanho fonte</label><input type="number" className={inputClass} value={(config.fontSize as number) ?? 18} onChange={e => set('fontSize', Number(e.target.value))} min={12} max={48} /></div>
        </div>
      )
    case 'qrcode':
      return (
        <div className="space-y-3">
          <div><label className={labelClass}>Tamanho (px)</label><input type="number" className={inputClass} value={(config.size as number) ?? 256} onChange={e => set('size', Number(e.target.value))} min={128} max={512} /></div>
          <div><label className={labelClass}>Legenda</label><input className={inputClass} value={(config.label as string) ?? ''} onChange={e => set('label', e.target.value)} placeholder="Doe aqui!" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>Cor QR</label><input type="color" className="w-full h-8 cursor-pointer" value={(config.fgColor as string) ?? '#FFFFFF'} onChange={e => set('fgColor', e.target.value)} /></div>
            <div><label className={labelClass}>Cor fundo</label><input type="color" className="w-full h-8 cursor-pointer" value={(config.bgColor as string) ?? '#000000'} onChange={e => set('bgColor', e.target.value)} /></div>
          </div>
        </div>
      )
    case 'recent':
      return (
        <div className="space-y-3">
          <div><label className={labelClass}>Max itens</label><input type="number" className={inputClass} value={(config.maxItems as number) ?? 10} onChange={e => set('maxItems', Number(e.target.value))} min={1} max={50} /></div>
          <div><label className={labelClass}>Tamanho fonte</label><input type="number" className={inputClass} value={(config.fontSize as number) ?? 16} onChange={e => set('fontSize', Number(e.target.value))} min={12} max={48} /></div>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" checked={(config.showMessage as boolean) !== false} onChange={e => set('showMessage', e.target.checked)} />
            Mostrar mensagem
          </label>
        </div>
      )
    case 'marathon':
      return (
        <div className="space-y-3">
          <div><label className={labelClass}>Tamanho fonte</label><input type="number" className={inputClass} value={(config.fontSize as number) ?? 72} onChange={e => set('fontSize', Number(e.target.value))} min={24} max={200} /></div>
          <div><label className={labelClass}>Cor texto</label><input type="color" className="w-full h-8 cursor-pointer" value={(config.textColor as string) ?? '#FFFFFF'} onChange={e => set('textColor', e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" checked={(config.showAddAnimation as boolean) !== false} onChange={e => set('showAddAnimation', e.target.checked)} />
            Animar tempo adicionado
          </label>
        </div>
      )
    case 'video':
    case 'music':
      return (
        <div className="space-y-3">
          <div><label className={labelClass}>Duracao max (segundos)</label><input type="number" className={inputClass} value={(config.maxDuration as number) ?? 300} onChange={e => set('maxDuration', Number(e.target.value))} min={30} max={600} /></div>
          <div><label className={labelClass}>Valor minimo (centavos)</label><input type="number" className={inputClass} value={(config.minAmountCents as number) ?? 500} onChange={e => set('minAmountCents', Number(e.target.value))} min={100} /></div>
          {type === 'music' && (
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={(config.showQueue as boolean) !== false} onChange={e => set('showQueue', e.target.checked)} />
              Mostrar fila
            </label>
          )}
        </div>
      )
    default:
      return <div className="text-zinc-400 text-sm">Sem configuracoes disponiveis para este tipo.</div>
  }
}

// --- Main Page ---

export default function WidgetsPage() {
  const { data, mutate } = useSWR<{ widgets: WidgetData[] }>('/api/widgets', fetcher)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editWidget, setEditWidget] = useState<WidgetData | null>(null)
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({})
  const [editName, setEditName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const widgets = data?.widgets ?? []

  const createWidget = useCallback(async (type: string, label: string) => {
    setLoading(true)
    try {
      await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: label }),
      })
      await mutate()
      setShowAddModal(false)
    } catch { /* silent */ }
    setLoading(false)
  }, [mutate])

  const toggleWidget = useCallback(async (w: WidgetData) => {
    await fetch(`/api/widgets/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !w.isActive }),
    })
    await mutate()
  }, [mutate])

  const deleteWidget = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este widget?')) return
    await fetch(`/api/widgets/${id}`, { method: 'DELETE' })
    await mutate()
  }, [mutate])

  const rotateToken = useCallback(async (id: string) => {
    if (!confirm('Regenerar token? O link atual deixara de funcionar.')) return
    await fetch(`/api/widgets/${id}/rotate-token`, { method: 'POST' })
    await mutate()
  }, [mutate])

  const copyUrl = useCallback((w: WidgetData) => {
    const url = `${window.location.origin}/widget/${w.id}?token=${w.token}`
    navigator.clipboard.writeText(url)
    setCopiedId(w.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const openEdit = useCallback((w: WidgetData) => {
    setEditWidget(w)
    setEditConfig(w.config)
    setEditName(w.name)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editWidget) return
    setLoading(true)
    await fetch(`/api/widgets/${editWidget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, config: editConfig }),
    })
    await mutate()
    setEditWidget(null)
    setLoading(false)
  }, [editWidget, editName, editConfig, mutate])

  const previewUrl = (w: WidgetData) =>
    `/widget/${w.id}?token=${w.token}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Widgets</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Adicionar Widget
        </button>
      </div>

      {/* Widget Grid */}
      {widgets.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-2">Nenhum widget criado ainda</p>
          <p className="text-sm">Clique em &quot;Adicionar Widget&quot; para comecar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map(w => {
            const info = getTypeInfo(w.type)
            return (
              <div
                key={w.id}
                className={`border rounded-xl p-4 space-y-3 transition-colors ${
                  w.isActive ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-900/30 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-purple-400">{info.icon}</div>
                    <div>
                      <div className="font-medium text-white">{w.name}</div>
                      <div className="text-xs text-zinc-500">{info.label}</div>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                    w.isActive ? 'bg-green-900/50 text-green-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {w.isActive ? 'Ativo' : 'Inativo'}
                  </div>
                </div>

                {/* Overlay URL */}
                <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                  <code className="text-xs text-zinc-400 truncate flex-1 select-all">{`${typeof window !== 'undefined' ? window.location.origin : ''}/widget/${w.id}?token=${w.token}`}</code>
                  <button onClick={() => copyUrl(w)} className="flex-shrink-0 p-1 hover:bg-zinc-700 rounded transition-colors" title="Copiar URL">
                    {copiedId === w.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-zinc-400" />}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => openEdit(w)} className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors" title="Configurar">
                    <Settings size={12} /> Config
                  </button>
                  <a href={previewUrl(w)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors" title="Preview">
                    <Eye size={12} /> Preview
                  </a>
                  <button onClick={() => toggleWidget(w)} className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors" title="Toggle">
                    <Power size={12} /> {w.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => rotateToken(w.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors" title="Regenerar token">
                    <RotateCcw size={12} /> Token
                  </button>
                  <button onClick={() => deleteWidget(w.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs transition-colors" title="Excluir">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Widget Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Adicionar Widget</h2>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {WIDGET_TYPES.map(wt => (
                  <button
                    key={wt.key}
                    disabled={loading}
                    onClick={() => createWidget(wt.key, wt.label)}
                    className="flex flex-col items-center gap-2 p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-purple-500 rounded-xl transition-colors text-center disabled:opacity-50"
                  >
                    <div className="text-purple-400">{wt.icon}</div>
                    <div className="font-medium text-white text-sm">{wt.label}</div>
                    <div className="text-xs text-zinc-500">{wt.description}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Widget Modal */}
      <AnimatePresence>
        {editWidget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setEditWidget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Configurar Widget</h2>
                <button onClick={() => setEditWidget(null)} className="text-zinc-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Nome</label>
                  <input
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
                <ConfigEditor type={editWidget.type} config={editConfig} onChange={setEditConfig} />
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveEdit}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => setEditWidget(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
