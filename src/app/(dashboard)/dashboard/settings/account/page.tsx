'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Check, AlertCircle } from 'lucide-react'

interface AccountData {
  username: string
  email: string
}

export default function AccountPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/private/profile')
      .then(r => r.json())
      .then((data: AccountData) => {
        setUsername(data.username || '')
        setEmail(data.email || '')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/private/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: 'Conta atualizada!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Minha Conta</h1>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder="seu-username"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Email</label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-500 cursor-not-allowed"
          />
          <p className="text-xs text-zinc-500 mt-1">O email e gerenciado pelo seu provedor de autenticacao.</p>
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
          Salvar
        </button>
      </div>
    </div>
  )
}
