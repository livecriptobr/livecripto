'use client'

import { useState, useEffect } from 'react'
import { User, Save, Loader2, Check, AlertCircle } from 'lucide-react'

export default function ProfilePage() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/private/profile')
      .then(r => r.json())
      .then(data => {
        setUsername(data.username || '')
        setDisplayName(data.displayName || '')
        setEmail(data.email || '')
        setOriginalUsername(data.username || '')
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/private/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setOriginalUsername(username)
      setMessage({ type: 'success', text: 'Perfil atualizado!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: message })
    } finally {
      setSaving(false)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Perfil</h1>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{displayName || username}</h2>
            <p className="text-zinc-400">{email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder="seu-username"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Sua pagina: {appUrl}/{username}
          </p>
          {username !== originalUsername && (
            <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Alterar o username muda sua URL publica
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Nome de exibicao</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder="Como voce quer ser chamado"
          />
        </div>

        {message && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alteracoes
        </button>
      </div>
    </div>
  )
}
