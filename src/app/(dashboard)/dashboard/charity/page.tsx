'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Plus, Target, Users, Calendar } from 'lucide-react'

interface Goal {
  id: string
  title: string
  description: string | null
  targetCents: number
  currentCents: number
  isActive: boolean
  charityName: string | null
  charityPercent: number | null
  deadline: string | null
  createdAt: string
  _count: { contributions: number }
}

interface GoalsResponse {
  goals: Goal[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<GoalsResponse>

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getTimeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Encerrado'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h restantes`
  return `${hours}h restantes`
}

export default function CharityPage() {
  const { data } = useSWR('/api/goals?type=charity', fetcher)

  const goals = data?.goals || []
  const activeGoals = goals.filter(g => g.isActive)
  const completedGoals = goals.filter(g => !g.isActive || g.currentCents >= g.targetCents)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-400" /> Acoes Solidarias
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Crie campanhas para arrecadar fundos para instituicoes de caridade
          </p>
        </div>
        <Link
          href="/dashboard/goals"
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Criar Acao Solidaria
        </Link>
      </div>

      {activeGoals.length === 0 && !data ? (
        <div className="text-center py-12 text-zinc-500">Carregando...</div>
      ) : activeGoals.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-700 rounded-2xl">
          <Heart className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <p className="text-zinc-400 text-lg">Nenhuma acao solidaria ativa</p>
          <p className="text-zinc-500 text-sm mt-2">
            Crie uma meta do tipo &quot;Solidaria&quot; na pagina de Vaquinhas
          </p>
          <Link
            href="/dashboard/goals"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-pink-600 hover:bg-pink-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Criar Acao Solidaria
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {activeGoals.map(goal => {
            const progress = goal.targetCents > 0 ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100)) : 0
            return (
              <motion.div
                key={goal.id}
                layout
                className="bg-zinc-900 border border-pink-500/20 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-pink-400" />
                  <h3 className="font-semibold text-white">{goal.title}</h3>
                </div>

                {goal.charityName && (
                  <p className="text-sm text-pink-400 mb-1">
                    {goal.charityPercent}% para {goal.charityName}
                  </p>
                )}

                {goal.description && (
                  <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{goal.description}</p>
                )}

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
                      className="h-full rounded-full bg-pink-500"
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
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {getTimeRemaining(goal.deadline)}
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-400" /> Campanhas Encerradas
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {completedGoals.map(goal => (
              <div key={goal.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 opacity-75">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <h3 className="font-medium text-zinc-300">{goal.title}</h3>
                </div>
                {goal.charityName && (
                  <p className="text-xs text-pink-400">{goal.charityName}</p>
                )}
                <p className="text-sm text-zinc-500 mt-1">
                  {formatCents(goal.currentCents)} arrecadados - {goal._count.contributions} contribuicoes
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
