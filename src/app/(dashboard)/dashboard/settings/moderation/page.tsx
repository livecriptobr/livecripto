'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2, Check, AlertCircle } from 'lucide-react'

interface ModerationSettingsData {
  blockedWordsEnabled: boolean
  blockedWords: string[]
  blockedWordsRegex: string[]
  useDefaultProfanityList: boolean
  gptModerationEnabled: boolean
  gptBlockHate: boolean
  gptBlockSexual: boolean
  gptBlockViolence: boolean
  gptBlockSelfHarm: boolean
  gptBlockThreatening: boolean
  gptBlockHarassment: boolean
  gptSensitivity: number
  audioModerationEnabled: boolean
  imageModerationEnabled: boolean
  autoBlockRepeatOffenders: boolean
  repeatOffenderThreshold: number
}

const DEFAULT_SETTINGS: ModerationSettingsData = {
  blockedWordsEnabled: false,
  blockedWords: [],
  blockedWordsRegex: [],
  useDefaultProfanityList: true,
  gptModerationEnabled: false,
  gptBlockHate: true,
  gptBlockSexual: true,
  gptBlockViolence: true,
  gptBlockSelfHarm: true,
  gptBlockThreatening: true,
  gptBlockHarassment: true,
  gptSensitivity: 0.7,
  audioModerationEnabled: false,
  imageModerationEnabled: false,
  autoBlockRepeatOffenders: false,
  repeatOffenderThreshold: 3,
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function ModerationSettingsPage() {
  const [settings, setSettings] = useState<ModerationSettingsData>(DEFAULT_SETTINGS)
  const [blockedWordsText, setBlockedWordsText] = useState('')
  const [regexText, setRegexText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/moderation')
      const data = await res.json()
      if (data.settings) {
        const s = { ...DEFAULT_SETTINGS, ...data.settings }
        setSettings(s)
        setBlockedWordsText((s.blockedWords as string[]).join('\n'))
        setRegexText((s.blockedWordsRegex as string[]).join('\n'))
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
      const payload = {
        ...settings,
        blockedWords: blockedWordsText.split('\n').map(w => w.trim()).filter(Boolean),
        blockedWordsRegex: regexText.split('\n').map(w => w.trim()).filter(Boolean),
      }
      const res = await fetch('/api/settings/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setMessage({ type: 'success', text: 'Configuracoes de moderacao salvas!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof ModerationSettingsData>(key: K, value: ModerationSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
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
      <h1 className="text-2xl font-bold">Moderacao</h1>

      {/* Blocked Words */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Palavras Bloqueadas</h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Ativar filtro de palavras</span>
          <Toggle
            enabled={settings.blockedWordsEnabled}
            onToggle={() => update('blockedWordsEnabled', !settings.blockedWordsEnabled)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-zinc-400">Usar lista padrao de palavroes (PT-BR)</span>
            <p className="text-xs text-zinc-600">Lista com termos ofensivos comuns em portugues</p>
          </div>
          <Toggle
            enabled={settings.useDefaultProfanityList}
            onToggle={() => update('useDefaultProfanityList', !settings.useDefaultProfanityList)}
          />
        </div>

        {settings.blockedWordsEnabled && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Palavras bloqueadas (uma por linha)
              </label>
              <textarea
                value={blockedWordsText}
                onChange={e => setBlockedWordsText(e.target.value)}
                rows={6}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm font-mono resize-y"
                placeholder={"palavra1\npalavra2\npalavra3"}
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Padroes Regex (um por linha)
              </label>
              <textarea
                value={regexText}
                onChange={e => setRegexText(e.target.value)}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm font-mono resize-y"
                placeholder={"p[a@]l[a@]vr[a@]\n\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"}
              />
              <p className="text-xs text-zinc-600 mt-1">Use expressoes regulares para padroes avancados</p>
            </div>
          </>
        )}
      </section>

      {/* GPT Moderation */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Moderacao por IA (OpenAI)</h2>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-zinc-400">Ativar moderacao por IA</span>
            <p className="text-xs text-zinc-600">Usa a API de moderacao da OpenAI para detectar conteudo toxico</p>
          </div>
          <Toggle
            enabled={settings.gptModerationEnabled}
            onToggle={() => update('gptModerationEnabled', !settings.gptModerationEnabled)}
          />
        </div>

        {settings.gptModerationEnabled && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-3">Categorias bloqueadas</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['gptBlockHate', 'Odio'] as const,
                  ['gptBlockSexual', 'Sexual'] as const,
                  ['gptBlockViolence', 'Violencia'] as const,
                  ['gptBlockSelfHarm', 'Auto-mutilacao'] as const,
                  ['gptBlockThreatening', 'Ameacas'] as const,
                  ['gptBlockHarassment', 'Assedio'] as const,
                ]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={() => update(key, !settings[key])}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-zinc-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Sensibilidade: {settings.gptSensitivity.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.gptSensitivity}
                onChange={e => update('gptSensitivity', parseFloat(e.target.value))}
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Mais permissivo</span>
                <span>Mais restritivo</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Audio/Image */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Moderacao de Midia</h2>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-zinc-400">Moderacao de audio</span>
            <p className="text-xs text-zinc-600">Em breve - Transcreve e analisa mensagens de voz</p>
          </div>
          <Toggle
            enabled={settings.audioModerationEnabled}
            onToggle={() => update('audioModerationEnabled', !settings.audioModerationEnabled)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-zinc-400">Moderacao de imagens</span>
            <p className="text-xs text-zinc-600">Em breve - Analisa imagens e GIFs enviados</p>
          </div>
          <Toggle
            enabled={settings.imageModerationEnabled}
            onToggle={() => update('imageModerationEnabled', !settings.imageModerationEnabled)}
          />
        </div>
      </section>

      {/* Auto-block */}
      <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-lg font-semibold">Bloqueio Automatico</h2>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-zinc-400">Bloquear reincidentes automaticamente</span>
            <p className="text-xs text-zinc-600">Bloqueia doadores que violam as regras repetidamente</p>
          </div>
          <Toggle
            enabled={settings.autoBlockRepeatOffenders}
            onToggle={() => update('autoBlockRepeatOffenders', !settings.autoBlockRepeatOffenders)}
          />
        </div>

        {settings.autoBlockRepeatOffenders && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Numero de violacoes para bloqueio
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={settings.repeatOffenderThreshold}
              onChange={e => update('repeatOffenderThreshold', parseInt(e.target.value) || 3)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
            />
          </div>
        )}
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
