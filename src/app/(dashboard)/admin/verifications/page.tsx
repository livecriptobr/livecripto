'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { CheckCircle, XCircle, Eye, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VerificationItem {
  id: string
  userId: string
  type: string
  status: string
  documentUrl: string | null
  documentBackUrl: string | null
  selfieUrl: string | null
  submittedAt: string
  user: {
    id: string
    username: string
    displayName: string | null
    email: string
  }
}

export default function AdminVerificationsPage() {
  const { user: clerkUser } = useUser()
  const [verifications, setVerifications] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const isAdmin = (clerkUser?.publicMetadata as Record<string, unknown>)?.role === 'admin'

  useEffect(() => {
    let cancelled = false
    if (!isAdmin) {
      // defer to avoid sync setState in effect
      Promise.resolve().then(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }
    fetch('/api/admin/verifications')
      .then(res => res.ok ? res.json() : null)
      .then((data: { verifications: VerificationItem[] } | null) => {
        if (cancelled || !data) return
        setVerifications(data.verifications)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAdmin])

  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/admin/verifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason }),
      })
      if (res.ok) {
        setVerifications(prev => prev.filter(v => v.id !== id))
        setRejectId(null)
        setRejectReason('')
      }
    } catch { /* ignore */ }
    setProcessing(null)
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-zinc-400">Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Verificações Pendentes</h1>
        <p className="text-zinc-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold">Verificações Pendentes</h1>
          <p className="text-zinc-400">{verifications.length} verificação(ões) aguardando análise</p>
        </div>
      </div>

      {verifications.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-zinc-300">Nenhuma verificação pendente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {verifications.map(v => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold">{v.user.displayName || v.user.username}</p>
                  <p className="text-sm text-zinc-400">@{v.user.username} - {v.user.email}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enviado em {new Date(v.submittedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mb-4 flex-wrap">
                {v.documentUrl && (
                  <button
                    onClick={() => setPreviewUrl(v.documentUrl)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Doc Frente
                  </button>
                )}
                {v.documentBackUrl && (
                  <button
                    onClick={() => setPreviewUrl(v.documentBackUrl)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Doc Verso
                  </button>
                )}
                {v.selfieUrl && (
                  <button
                    onClick={() => setPreviewUrl(v.selfieUrl)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Selfie
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(v.id, 'approve')}
                  disabled={processing === v.id}
                  className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprovar
                </button>
                <button
                  onClick={() => setRejectId(v.id)}
                  disabled={processing === v.id}
                  className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-2xl max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Documento" className="max-w-full max-h-[80vh] rounded-xl" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setRejectId(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Rejeitar verificação</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição..."
                rows={3}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setRejectId(null); setRejectReason('') }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => rejectId && handleAction(rejectId, 'reject', rejectReason)}
                  disabled={!rejectReason.trim() || processing === rejectId}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Confirmar rejeição
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
