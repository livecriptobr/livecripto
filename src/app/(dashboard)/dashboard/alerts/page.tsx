'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'

interface AlertSettings {
  minAmountCents: number
  ttsEnabled: boolean
  ttsVoice: string
  ttsTemplate: string
  durationMs: number
  blockedWords: string[]
}

const VOICES = [
  { value: 'pt-BR-Standard-A', label: 'Feminina (Standard A)' },
  { value: 'pt-BR-Standard-B', label: 'Masculina (Standard B)' },
  { value: 'pt-BR-Standard-C', label: 'Feminina (Standard C)' },
  { value: 'pt-BR-Wavenet-A', label: 'Feminina Natural (Wavenet A)' },
  { value: 'pt-BR-Wavenet-B', label: 'Masculina Natural (Wavenet B)' },
]

export default function AlertsPage() {
  const [settings, setSettings] = useState<AlertSettings>({
    minAmountCents: 100,
    ttsEnabled: true,
    ttsVoice: 'pt-BR-Standard-A',
    ttsTemplate: '{nome} doou {valor}. {mensagem}',
    durationMs: 8000,
    blockedWords: [],
  })
  const [blockedWordsText, setBlockedWordsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/private/alert-settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setSettings(data.settings)
          setBlockedWordsText((data.settings.blockedWords || []).join(', '))
        }
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const updatedSettings = {
        ...settings,
        blockedWords: blockedWordsText
          .split(',')
          .map(w => w.trim().toLowerCase())
          .filter(Boolean),
      }

      const res = await fetch('/api/private/alert-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      })

      if (!res.ok) throw new Error('Erro ao salvar')

      setMessage({ type: 'success', text: 'Configuracoes salvas!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Configuracoes de Alertas</h1>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
        {/* TTS Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Text-to-Speech (TTS)</h3>
            <p className="text-sm text-zinc-400">Ler mensagens em voz alta</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, ttsEnabled: !settings.ttsEnabled })}
            className={`w-14 h-8 rounded-full transition-colors ${
              settings.ttsEnabled ? 'bg-purple-600' : 'bg-zinc-700'
            }`}
          >
            <div className={`w-6 h-6 bg-white rounded-full transform transition-transform ${
              settings.ttsEnabled ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Voice */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Voz</label>
          <select
            value={settings.ttsVoice}
            onChange={e => setSettings({ ...settings, ttsVoice: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
          >
            {VOICES.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Template */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Template da mensagem</label>
          <input
            type="text"
            value={settings.ttsTemplate}
            onChange={e => setSettings({ ...settings, ttsTemplate: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Variaveis: {'{nome}'}, {'{valor}'}, {'{mensagem}'}
          </p>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Duracao do alerta: {settings.durationMs / 1000}s
          </label>
          <input
            type="range"
            min="3000"
            max="20000"
            step="1000"
            value={settings.durationMs}
            onChange={e => setSettings({ ...settings, durationMs: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Min Amount */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Valor minimo (R$)</label>
          <input
            type="number"
            step="0.01"
            value={settings.minAmountCents / 100}
            onChange={e => setSettings({ ...settings, minAmountCents: Math.round(parseFloat(e.target.value) * 100) })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
          />
        </div>

        {/* Blocked Words */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Palavras bloqueadas</label>
          <input
            type="text"
            value={blockedWordsText}
            onChange={e => setBlockedWordsText(e.target.value)}
            placeholder="palavra1, palavra2, palavra3"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
          />
          <p className="text-xs text-zinc-500 mt-1">Separadas por virgula</p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar Configuracoes
        </button>
      </div>
    </div>
  )
}
