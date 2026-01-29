'use client'

import { useState } from 'react'
import { useUser, useSessionList } from '@clerk/nextjs'
import { Shield, Smartphone, Key, LogOut, Monitor } from 'lucide-react'
import { motion } from 'framer-motion'

interface SessionResource {
  id: string
  status: string
  lastActiveAt: Date
  latestActivity?: {
    deviceType?: string
    browserName?: string
    city?: string
    country?: string
  }
  revoke: () => Promise<unknown>
}

export default function SecurityPage() {
  const { user } = useUser()
  const { sessions, isLoaded } = useSessionList()
  const [revoking, setRevoking] = useState<string | null>(null)
  const [showClerkProfile, setShowClerkProfile] = useState(false)

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId)
    try {
      const session = (sessions as unknown as SessionResource[])?.find(s => s.id === sessionId)
      if (session) {
        await session.revoke()
      }
    } catch { /* ignore */ }
    setRevoking(null)
  }

  const handleRevokeAll = async () => {
    if (!sessions) return
    setRevoking('all')
    try {
      const currentSessionId = (sessions as unknown as SessionResource[])?.[0]?.id
      for (const session of sessions as unknown as SessionResource[]) {
        if (session.id !== currentSessionId && session.status === 'active') {
          await session.revoke()
        }
      }
    } catch { /* ignore */ }
    setRevoking(null)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Segurança</h1>
        <p className="text-zinc-400 mt-1">Gerencie suas sessões e configurações de segurança</p>
      </div>

      {/* Active Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5 text-violet-400" />
            Sessões ativas
          </h2>
          {(sessions as unknown as SessionResource[])?.length > 1 && (
            <button
              onClick={handleRevokeAll}
              disabled={revoking === 'all'}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {revoking === 'all' ? 'Revogando...' : 'Encerrar todas as outras'}
            </button>
          )}
        </div>

        {!isLoaded ? (
          <p className="text-zinc-400 text-sm">Carregando sessões...</p>
        ) : (
          <div className="space-y-3">
            {(sessions as unknown as SessionResource[])?.map((session, i) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
                    {session.latestActivity?.deviceType === 'mobile' ? (
                      <Smartphone className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <Monitor className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {session.latestActivity?.browserName || 'Navegador desconhecido'}
                      {i === 0 && (
                        <span className="ml-2 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          Sessão atual
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {session.latestActivity?.city && session.latestActivity?.country
                        ? `${session.latestActivity.city}, ${session.latestActivity.country}`
                        : 'Localização desconhecida'}
                      {' - '}
                      Último acesso: {new Date(session.lastActiveAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                {i !== 0 && (
                  <button
                    onClick={() => handleRevoke(session.id)}
                    disabled={revoking === session.id}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg text-xs transition-colors"
                  >
                    {revoking === session.id ? 'Revogando...' : 'Encerrar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Two-Factor Authentication */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-400" />
          Autenticação de dois fatores (2FA)
        </h2>
        <p className="text-sm text-zinc-400">
          Adicione uma camada extra de segurança à sua conta ativando a autenticação de dois fatores.
        </p>
        {user?.twoFactorEnabled ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Shield className="w-4 h-4" />
            2FA está ativado
          </div>
        ) : (
          <button
            onClick={() => setShowClerkProfile(!showClerkProfile)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-medium transition-colors"
          >
            Configurar 2FA
          </button>
        )}
        {showClerkProfile && (
          <p className="text-sm text-zinc-400">
            Para configurar 2FA, acesse as configurações da sua conta Clerk clicando no seu avatar no menu.
          </p>
        )}
      </motion.div>

      {/* Password */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Key className="w-5 h-5 text-violet-400" />
          Senha
        </h2>
        <p className="text-sm text-zinc-400">
          Para alterar sua senha, utilize o menu do perfil Clerk (clique no seu avatar).
        </p>
        {user?.passwordEnabled ? (
          <p className="text-sm text-green-400">Senha configurada</p>
        ) : (
          <p className="text-sm text-yellow-400">
            Nenhuma senha definida (login via provedor social)
          </p>
        )}
      </motion.div>
    </div>
  )
}
