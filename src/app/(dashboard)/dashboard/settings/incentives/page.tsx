'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2, Check, AlertCircle, Plus, Trash2, Upload } from 'lucide-react'

interface IncentiveSettingsData {
  voiceMessagesEnabled: boolean
  voiceMessageMaxSecs: number
  mediaEnabled: boolean
  mediaGifsOnly: boolean
  ttsEnabled: boolean
  ttsDefaultVoice: string
  ttsDefaultSpeed: number
  minAmountForVoice: number
  minAmountForMedia: number
  minAmountForTts: number
}

interface AlertTierData {
  id?: string
  minAmountCents: number
  name: string
  color: string
  soundUrl: string | null
  animationType: string
  duration: number
  ttsVoice: string | null
  ttsSpeed: number
  isActive: boolean
}

const DEFAULT_SETTINGS: IncentiveSettingsData = {
  voiceMessagesEnabled: false,
  voiceMessageMaxSecs: 15,
  mediaEnabled: false,
  mediaGifsOnly: true,
  ttsEnabled: false,
  ttsDefaultVoice: 'pt-BR-FranciscaNeural',
  ttsDefaultSpeed: 1.0,
  minAmountForVoice: 500,
  minAmountForMedia: 500,
  minAmountForTts: 100,
}

const VOICE_OPTIONS = [
  { value: 'pt-BR-FranciscaNeural', label: 'Francisca (PT-BR)' },
  { value: 'pt-BR-AntonioNeural', label: 'Antonio (PT-BR)' },
  { value: 'en-US-JennyNeural', label: 'Jenny (EN-US)' },
  { value: 'en-US-GuyNeural', label: 'Guy (EN-US)' },
  { value: 'es-ES-ElviraNeural', label: 'Elvira (ES)' },
]

const ANIMATION_OPTIONS = [
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'shake', label: 'Shake' },
]

export default function IncentivesPage() {
  const [settings, setSettings] = useState<IncentiveSettingsData>(DEFAULT_SETTINGS)
  const [tiers, setTiers] = useState<AlertTierData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/incentives')
      const data = await res.json()
      if (data.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
      if (data.tiers) {
        setTiers(data.tiers)
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/incentives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, tiers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setMessage({ type: 'success', text: 'Configuracoes salvas!' })
      loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  const addTier = () => {
    setTiers([...tiers, {
      minAmountCents: 1000,
      name: 'Novo Tier',
      color: '#8B5CF6',
      soundUrl: null,
      animationType: 'fadeIn',
      duration: 5,
      ttsVoice: null,
      ttsSpeed: 1.0,
      isActive: true,
    }])
  }

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, field: keyof AlertTierData, value: string | number | boolean | null) => {
    setTiers(tiers.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const handleSoundUpload = async (index: number, file: File) => {
    const formData = new FormData()
    formData.append('sound', file)
    try {
      const res = await fetch('/api/upload/alert-sound', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      updateTier(index, 'soundUrl', data.url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro no upload'
      setMessage({ type: 'error', text: msg })
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
      <h1 className="text-2xl font-bold">Incentivos</h1>

      {/* TTS Section */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Text-to-Speech (TTS)</h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Ativar TTS nas doacoes</span>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, ttsEnabled: !settings.ttsEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.ttsEnabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.ttsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {settings.ttsEnabled && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Voz padrao</label>
              <select
                value={settings.ttsDefaultVoice}
                onChange={(e) => setSettings({ ...settings, ttsDefaultVoice: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Velocidade: {settings.ttsDefaultSpeed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.ttsDefaultSpeed}
                onChange={(e) => setSettings({ ...settings, ttsDefaultSpeed: parseFloat(e.target.value) })}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Valor minimo para TTS (centavos)</label>
              <input
                type="number"
                value={settings.minAmountForTts}
                onChange={(e) => setSettings({ ...settings, minAmountForTts: parseInt(e.target.value) || 0 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">R$ {(settings.minAmountForTts / 100).toFixed(2)}</p>
            </div>
          </>
        )}
      </section>

      {/* Voice Messages Section */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Mensagens de Voz</h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Permitir mensagens de voz</span>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, voiceMessagesEnabled: !settings.voiceMessagesEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.voiceMessagesEnabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.voiceMessagesEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {settings.voiceMessagesEnabled && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Duracao maxima (segundos)</label>
              <input
                type="number"
                min={5}
                max={60}
                value={settings.voiceMessageMaxSecs}
                onChange={(e) => setSettings({ ...settings, voiceMessageMaxSecs: parseInt(e.target.value) || 15 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Valor minimo para voz (centavos)</label>
              <input
                type="number"
                value={settings.minAmountForVoice}
                onChange={(e) => setSettings({ ...settings, minAmountForVoice: parseInt(e.target.value) || 0 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">R$ {(settings.minAmountForVoice / 100).toFixed(2)}</p>
            </div>
          </>
        )}
      </section>

      {/* Media Section */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Midia (GIFs/Imagens)</h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Permitir midia nas doacoes</span>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, mediaEnabled: !settings.mediaEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.mediaEnabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.mediaEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {settings.mediaEnabled && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Apenas GIFs</span>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, mediaGifsOnly: !settings.mediaGifsOnly })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.mediaGifsOnly ? 'bg-purple-600' : 'bg-zinc-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.mediaGifsOnly ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Valor minimo para midia (centavos)</label>
              <input
                type="number"
                value={settings.minAmountForMedia}
                onChange={(e) => setSettings({ ...settings, minAmountForMedia: parseInt(e.target.value) || 0 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">R$ {(settings.minAmountForMedia / 100).toFixed(2)}</p>
            </div>
          </>
        )}
      </section>

      {/* Alert Tiers */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tiers de Alerta</h2>
          <button
            type="button"
            onClick={addTier}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {tiers.length === 0 && (
          <p className="text-zinc-500 text-sm">Nenhum tier configurado. Adicione tiers para personalizar alertas por valor.</p>
        )}

        {tiers.map((tier, idx) => (
          <div key={tier.id || `new-${idx}`} className="bg-zinc-800 rounded-lg p-4 space-y-3 border border-zinc-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: tier.color }}>{tier.name}</span>
              <button type="button" onClick={() => removeTier(idx)} className="text-zinc-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Nome</label>
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => updateTier(idx, 'name', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Valor minimo (centavos)</label>
                <input
                  type="number"
                  value={tier.minAmountCents}
                  onChange={(e) => updateTier(idx, 'minAmountCents', parseInt(e.target.value) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Cor</label>
                <input
                  type="color"
                  value={tier.color}
                  onChange={(e) => updateTier(idx, 'color', e.target.value)}
                  className="w-full h-8 bg-zinc-900 border border-zinc-700 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Animacao</label>
                <select
                  value={tier.animationType}
                  onChange={(e) => updateTier(idx, 'animationType', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  {ANIMATION_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Duracao (s)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={tier.duration}
                  onChange={(e) => updateTier(idx, 'duration', parseInt(e.target.value) || 5)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Voz TTS (override)</label>
                <select
                  value={tier.ttsVoice || ''}
                  onChange={(e) => updateTier(idx, 'ttsVoice', e.target.value || null)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="">Padrao</option>
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Velocidade TTS: {tier.ttsSpeed.toFixed(1)}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={tier.ttsSpeed}
                  onChange={(e) => updateTier(idx, 'ttsSpeed', parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Som do alerta</label>
                <div className="flex items-center gap-2">
                  {tier.soundUrl ? (
                    <span className="text-xs text-green-400 truncate flex-1">{tier.soundUrl.split('/').pop()}</span>
                  ) : (
                    <span className="text-xs text-zinc-500 flex-1">Nenhum</span>
                  )}
                  <label className="cursor-pointer p-1.5 bg-zinc-900 border border-zinc-700 rounded hover:border-purple-500">
                    <Upload className="w-3 h-3 text-zinc-400" />
                    <input
                      type="file"
                      accept=".mp3,.wav"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleSoundUpload(idx, file)
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
              <span className="text-xs text-zinc-500">Ativo</span>
              <button
                type="button"
                onClick={() => updateTier(idx, 'isActive', !tier.isActive)}
                className={`w-10 h-5 rounded-full transition-colors relative ${tier.isActive ? 'bg-purple-600' : 'bg-zinc-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${tier.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Message & Save */}
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Configuracoes
      </button>
    </div>
  )
}
