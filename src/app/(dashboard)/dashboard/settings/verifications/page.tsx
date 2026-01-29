'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Shield, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Unlink } from 'lucide-react'
import { motion } from 'framer-motion'

interface VerificationRecord {
  id: string
  type: string
  status: string
  documentUrl: string | null
  documentBackUrl: string | null
  selfieUrl: string | null
  externalId: string | null
  externalName: string | null
  rejectionReason: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Pendente', color: 'text-yellow-400', icon: Clock },
  reviewing: { label: 'Em análise', color: 'text-blue-400', icon: Clock },
  approved: { label: 'Aprovado', color: 'text-green-400', icon: CheckCircle },
  rejected: { label: 'Rejeitado', color: 'text-red-400', icon: XCircle },
}

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState<'doc' | 'selfie' | 'done'>('doc')
  const [error, setError] = useState('')

  const identity = verifications.find(v => v.type === 'identity')
  const twitch = verifications.find(v => v.type === 'twitch')
  const youtube = verifications.find(v => v.type === 'youtube')

  const fetchVerifications = useCallback(async () => {
    try {
      const res = await fetch('/api/verification/status')
      if (res.ok) {
        const data = (await res.json()) as { verifications: VerificationRecord[] }
        setVerifications(data.verifications)
        const id = data.verifications.find((v: VerificationRecord) => v.type === 'identity')
        if (id) {
          if (id.selfieUrl) setStep('done')
          else if (id.documentUrl) setStep('selfie')
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/verification/status')
      .then(res => res.ok ? res.json() : null)
      .then((data: { verifications: VerificationRecord[] } | null) => {
        if (cancelled || !data) return
        setVerifications(data.verifications)
        const id = data.verifications.find(v => v.type === 'identity')
        if (id) {
          if (id.selfieUrl) setStep('done')
          else if (id.documentUrl) setStep('selfie')
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleDocUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setUploading(true)

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/verification/upload-document', {
        method: 'POST',
        body: form,
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Erro ao enviar')
      } else {
        setStep('selfie')
        await fetchVerifications()
      }
    } catch {
      setError('Erro de conexão')
    }
    setUploading(false)
  }

  const handleSelfieUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setUploading(true)

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/verification/upload-selfie', {
        method: 'POST',
        body: form,
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Erro ao enviar')
      } else {
        setStep('done')
        await fetchVerifications()
      }
    } catch {
      setError('Erro de conexão')
    }
    setUploading(false)
  }

  const handleDisconnect = async (platform: string) => {
    try {
      const res = await fetch(`/api/verification/social/${platform}/disconnect`, { method: 'POST' })
      if (res.ok) {
        await fetchVerifications()
      }
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Verificações</h1>
        <p className="text-zinc-400">Carregando...</p>
      </div>
    )
  }

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    const Icon = cfg.icon
    return (
      <span className={`flex items-center gap-1 text-sm ${cfg.color}`}>
        <Icon className="w-4 h-4" />
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Verificações</h1>
        <p className="text-zinc-400 mt-1">Verifique sua identidade e conecte suas redes sociais</p>
      </div>

      {/* Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4"
      >
        <h3 className="text-violet-300 font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Benefícios da verificação
        </h3>
        <ul className="mt-2 text-sm text-zinc-300 space-y-1 list-disc list-inside">
          <li>Selo de verificação no seu perfil</li>
          <li>Maior confiança dos doadores</li>
          <li>Limites maiores para saques</li>
          <li>Prioridade no suporte</li>
        </ul>
      </motion.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Identity Verification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Verificação de Identidade</h2>
          {identity && renderStatusBadge(identity.status)}
        </div>

        {identity?.status === 'rejected' && identity.rejectionReason && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
            <strong>Motivo:</strong> {identity.rejectionReason}
          </div>
        )}

        {(!identity || identity.status === 'rejected') && step === 'doc' && (
          <form onSubmit={handleDocUpload} className="space-y-4">
            <p className="text-sm text-zinc-400">
              Envie uma foto do seu documento (RG, CNH ou passaporte).
            </p>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Frente do documento *
              </label>
              <input
                type="file"
                name="documentFront"
                accept="image/jpeg,image/png"
                required
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Verso do documento (opcional)
              </label>
              <input
                type="file"
                name="documentBack"
                accept="image/jpeg,image/png"
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-700 file:text-white hover:file:bg-zinc-600 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Enviar documento'}
            </button>
          </form>
        )}

        {identity && step === 'selfie' && identity.status !== 'rejected' && (
          <form onSubmit={handleSelfieUpload} className="space-y-4">
            <p className="text-sm text-zinc-400">
              Agora envie uma selfie segurando o documento para confirmar sua identidade.
            </p>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Selfie com documento *
              </label>
              <input
                type="file"
                name="selfie"
                accept="image/jpeg,image/png"
                required
                className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Enviar selfie'}
            </button>
          </form>
        )}

        {identity && step === 'done' && identity.status !== 'rejected' && (
          <p className="text-sm text-zinc-400">
            {identity.status === 'approved'
              ? 'Sua identidade foi verificada com sucesso!'
              : 'Seus documentos foram enviados e estão sendo analisados. Você será notificado quando a verificação for concluída.'}
          </p>
        )}
      </motion.div>

      {/* Social Verifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">Redes Sociais</h2>

        {/* Twitch */}
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Twitch</p>
              {twitch ? (
                <p className="text-sm text-green-400">{twitch.externalName}</p>
              ) : (
                <p className="text-sm text-zinc-400">Não conectado</p>
              )}
            </div>
          </div>
          {twitch ? (
            <button
              onClick={() => handleDisconnect('twitch')}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
            >
              <Unlink className="w-4 h-4" />
              Desconectar
            </button>
          ) : (
            <Link
              href="/api/verification/social/twitch"
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              Conectar
            </Link>
          )}
        </div>

        {/* YouTube */}
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">YouTube</p>
              {youtube ? (
                <p className="text-sm text-green-400">{youtube.externalName}</p>
              ) : (
                <p className="text-sm text-zinc-400">Não conectado</p>
              )}
            </div>
          </div>
          {youtube ? (
            <button
              onClick={() => handleDisconnect('youtube')}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
            >
              <Unlink className="w-4 h-4" />
              Desconectar
            </button>
          ) : (
            <Link
              href="/api/verification/social/youtube"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
            >
              Conectar
            </Link>
          )}
        </div>

        {/* Instagram */}
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Instagram</p>
              <p className="text-sm text-zinc-500">Em breve</p>
            </div>
          </div>
          <span className="px-4 py-1.5 bg-zinc-700/50 rounded-lg text-sm text-zinc-500 cursor-not-allowed">
            Em breve
          </span>
        </div>
      </motion.div>
    </div>
  )
}
