'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Target, Trophy, Heart, Edit2, X, Gift, Eye, EyeOff, Calendar, Users } from 'lucide-react'

interface GoalReward {
  id: string
  title: string
  thresholdCents: number
  type: string
  claimedCount: number
  maxClaims: number | null
  isActive: boolean
}

interface Goal {
  id: string
  title: string
  description: string | null
  targetCents: number
  currentCents: number
  imageUrl: string | null
  deadline: string | null
  isActive: boolean
  showOnDonation: boolean
  showOnOverlay: boolean
  type: string
  charityName: string | null
  charityPercent: number | null
  createdAt: string
  rewards: GoalReward[]
  _count: { contributions: number }
}

interface GoalsResponse {
  goals: Goal[]
}

interface GoalFormData {
  title: string
  description: string
  targetAmount: string
  type: 'personal' | 'charity'
  charityName: string
  charityPercent: string
  deadline: string
  showOnDonation: boolean
  showOnOverlay: boolean
  imageUrl: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<GoalsResponse>

const defaultForm: GoalFormData = {
  title: '',
  description: '',
  targetAmount: '',
  type: 'personal',
  charityName: '',
  charityPercent: '100',
  deadline: '',
  showOnDonation: true,
  showOnOverlay: true,
  imageUrl: '',
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getProgress(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function getTimeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Encerrado'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h restantes`
  return `${hours}h restantes`
}

export default function GoalsPage() {
  const { data, mutate } = useSWR('/api/goals', fetcher)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GoalFormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const goals = data?.goals || []
  const activeGoals = goals.filter(g => g.isActive)
  const completedGoals = goals.filter(g => !g.isActive || g.currentCents >= g.targetCents)

  const resetForm = useCallback(() => {
    setForm(defaultForm)
    setShowForm(false)
    setEditingId(null)
  }, [])

  const startEdit = useCallback((goal: Goal) => {
    setForm({
      title: goal.title,
      description: goal.description || '',
      targetAmount: (goal.targetCents / 100).toFixed(2),
      type: goal.type as 'personal' | 'charity',
      charityName: goal.charityName || '',
      charityPercent: goal.charityPercent?.toString() || '100',
      deadline: goal.deadline ? goal.deadline.slice(0, 16) : '',
      showOnDonation: goal.showOnDonation,
      showOnOverlay: goal.showOnOverlay,
      imageUrl: goal.imageUrl || '',
    })
    setEditingId(goal.id)
    setShowForm(true)
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/upload/goal-image', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        setForm(prev => ({ ...prev, imageUrl: data.url as string }))
      }
    } catch { /* silent */ }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const targetCents = Math.round(parseFloat(form.targetAmount.replace(',', '.') || '0') * 100)

    const body = {
      title: form.title,
      description: form.description || undefined,
      targetCents,
      imageUrl: form.imageUrl || undefined,
      deadline: form.deadline || undefined,
      showOnDonation: form.showOnDonation,
      showOnOverlay: form.showOnOverlay,
      type: form.type,
      charityName: form.type === 'charity' ? form.charityName : undefined,
      charityPercent: form.type === 'charity' ? parseInt(form.charityPercent) || 100 : undefined,
    }

    try {
      const url = editingId ? `/api/goals/${editingId}` : '/api/goals'
      const method = editingId ? 'PATCH' : 'POST'
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await mutate()
      resetForm()
    } catch { /* silent */ }
    setSaving(false)
  }

  const toggleActive = async (goalId: string, isActive: boolean) => {
    await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    await mutate()
  }

  const deleteGoal = async (goalId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta vaquinha?')) return
    await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
    await mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Vaquinhas & Metas</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Meta
        </button>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editingId ? 'Editar Meta' : 'Nova Meta'}
                </h2>
                <button onClick={resetForm} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: 'personal' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === 'personal'
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Target className="w-4 h-4 inline mr-1" /> Pessoal
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: 'charity' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === 'charity'
                        ? 'bg-pink-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Heart className="w-4 h-4 inline mr-1" /> Solidaria
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Titulo</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Descricao</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none resize-none"
                    rows={3}
                    maxLength={1000}
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Meta (R$)</label>
                  <input
                    type="text"
                    value={form.targetAmount}
                    onChange={e => setForm(prev => ({ ...prev, targetAmount: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="0,00"
                    required
                  />
                </div>

                {form.type === 'charity' && (
                  <>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Nome da Instituicao</label>
                      <input
                        value={form.charityName}
                        onChange={e => setForm(prev => ({ ...prev, charityName: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">% para Instituicao</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={form.charityPercent}
                        onChange={e => setForm(prev => ({ ...prev, charityPercent: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Prazo (opcional)</label>
                  <input
                    type="datetime-local"
                    value={form.deadline}
                    onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Imagem (opcional)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="w-full text-sm text-zinc-400"
                    disabled={uploading}
                  />
                  {uploading && <p className="text-xs text-zinc-500 mt-1">Enviando...</p>}
                  {form.imageUrl && (
                    <p className="text-xs text-green-400 mt-1">Imagem enviada</p>
                  )}
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.showOnDonation}
                      onChange={e => setForm(prev => ({ ...prev, showOnDonation: e.target.checked }))}
                      className="rounded"
                    />
                    Exibir na doacao
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.showOnOverlay}
                      onChange={e => setForm(prev => ({ ...prev, showOnOverlay: e.target.checked }))}
                      className="rounded"
                    />
                    Exibir no overlay
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Meta'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Goals */}
      {activeGoals.length === 0 && !data ? (
        <div className="text-center py-12 text-zinc-500">Carregando...</div>
      ) : activeGoals.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-700 rounded-2xl">
          <Target className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-400">Nenhuma meta ativa</p>
          <p className="text-zinc-500 text-sm mt-1">Crie sua primeira vaquinha para receber contribuicoes</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {activeGoals.map(goal => {
            const progress = getProgress(goal.currentCents, goal.targetCents)
            const isCompleted = goal.currentCents >= goal.targetCents
            return (
              <motion.div
                key={goal.id}
                layout
                className={`bg-zinc-900 border rounded-xl p-5 ${
                  isCompleted ? 'border-green-500/50' : 'border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {goal.type === 'charity' ? (
                      <Heart className="w-5 h-5 text-pink-400" />
                    ) : (
                      <Target className="w-5 h-5 text-purple-400" />
                    )}
                    <h3 className="font-semibold text-white">{goal.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {goal.showOnDonation ? (
                      <Eye className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                </div>

                {goal.description && (
                  <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{goal.description}</p>
                )}

                {goal.charityName && (
                  <p className="text-xs text-pink-400 mb-2">
                    {goal.charityPercent}% para {goal.charityName}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">{formatCents(goal.currentCents)}</span>
                    <span className="text-zinc-500">{formatCents(goal.targetCents)}</span>
                  </div>
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded-full ${
                        isCompleted ? 'bg-green-500' : goal.type === 'charity' ? 'bg-pink-500' : 'bg-purple-500'
                      }`}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-zinc-500">{progress}%</span>
                    <span className="text-zinc-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {goal._count.contributions}
                    </span>
                  </div>
                </div>

                {goal.deadline && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mb-3">
                    <Calendar className="w-3 h-3" /> {getTimeRemaining(goal.deadline)}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
                  <button
                    onClick={() => startEdit(goal)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <Link
                    href={`/dashboard/goals/${goal.id}/rewards`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
                  >
                    <Gift className="w-3 h-3" /> Recompensas ({goal.rewards.length})
                  </Link>
                  <button
                    onClick={() => toggleActive(goal.id, goal.isActive)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-yellow-400 transition-colors ml-auto"
                  >
                    {goal.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-red-900/50 rounded-lg text-xs text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Metas Concluidas
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {completedGoals.map(goal => (
              <div
                key={goal.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 opacity-75"
              >
                <div className="flex items-center gap-2 mb-2">
                  {goal.type === 'charity' ? (
                    <Heart className="w-4 h-4 text-pink-400" />
                  ) : (
                    <Trophy className="w-4 h-4 text-yellow-400" />
                  )}
                  <h3 className="font-medium text-zinc-300">{goal.title}</h3>
                </div>
                <p className="text-sm text-zinc-500">
                  {formatCents(goal.currentCents)} / {formatCents(goal.targetCents)} - {goal._count.contributions} contribuicoes
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
