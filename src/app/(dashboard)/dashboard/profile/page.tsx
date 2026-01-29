'use client'

import { useState, useEffect } from 'react'
import { User, Save, Loader2, Check, AlertCircle } from 'lucide-react'

interface SocialLinks {
  twitch?: string
  youtube?: string
  instagram?: string
  twitter?: string
  tiktok?: string
}

interface ProfileData {
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  primaryColor: string | null
  backgroundColor: string | null
  backgroundImageUrl: string | null
  bio: string | null
  socialLinks: SocialLinks | null
  donationPageTitle: string | null
  thankYouMessage: string | null
  phone: string | null
}

export default function ProfilePage() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#8B5CF6')
  const [backgroundColor, setBackgroundColor] = useState('#0F0A1E')
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('')
  const [bio, setBio] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({})
  const [donationPageTitle, setDonationPageTitle] = useState('')
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/private/profile')
      .then(r => r.json())
      .then((data: ProfileData) => {
        setUsername(data.username || '')
        setDisplayName(data.displayName || '')
        setEmail(data.email || '')
        setAvatarUrl(data.avatarUrl || '')
        setPrimaryColor(data.primaryColor || '#8B5CF6')
        setBackgroundColor(data.backgroundColor || '#0F0A1E')
        setBackgroundImageUrl(data.backgroundImageUrl || '')
        setBio(data.bio || '')
        setSocialLinks((data.socialLinks as SocialLinks) || {})
        setDonationPageTitle(data.donationPageTitle || '')
        setThankYouMessage(data.thankYouMessage || '')
        setPhone(data.phone || '')
        setOriginalUsername(data.username || '')
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
        body: JSON.stringify({
          username,
          displayName,
          avatarUrl,
          primaryColor,
          backgroundColor,
          backgroundImageUrl,
          bio,
          socialLinks,
          donationPageTitle,
          thankYouMessage,
          phone,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setOriginalUsername(username)
      setMessage({ type: 'success', text: 'Perfil atualizado!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  const updateSocialLink = (key: keyof SocialLinks, value: string) => {
    setSocialLinks(prev => ({ ...prev, [key]: value }))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Perfil</h1>

      {/* Avatar & Basic Info */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
        <h2 className="text-lg font-semibold">Informacoes Basicas</h2>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-purple-600/20 shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-purple-400" />
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm text-zinc-400 mb-1">URL do Avatar</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm"
              placeholder="https://exemplo.com/avatar.png"
            />
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

        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Bio
            <span className="float-right text-xs">{bio.length}/500</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 resize-none"
            placeholder="Conte um pouco sobre voce..."
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Telefone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder="+55 11 99999-9999"
          />
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
        <h2 className="text-lg font-semibold">Aparencia da Pagina de Doacao</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Cor Primaria</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-zinc-700 bg-transparent"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm font-mono"
                placeholder="#8B5CF6"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Cor de Fundo</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={backgroundColor}
                onChange={e => setBackgroundColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-zinc-700 bg-transparent"
              />
              <input
                type="text"
                value={backgroundColor}
                onChange={e => setBackgroundColor(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm font-mono"
                placeholder="#0F0A1E"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">URL da Imagem de Fundo</label>
          <input
            type="url"
            value={backgroundImageUrl}
            onChange={e => setBackgroundImageUrl(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder="https://exemplo.com/background.jpg"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Titulo da Pagina de Doacao</label>
          <input
            type="text"
            value={donationPageTitle}
            onChange={e => setDonationPageTitle(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder={`Apoie ${displayName || username}`}
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Mensagem de Agradecimento</label>
          <input
            type="text"
            value={thankYouMessage}
            onChange={e => setThankYouMessage(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
            placeholder="Obrigado pela sua doacao!"
          />
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
        <h2 className="text-lg font-semibold">Redes Sociais</h2>

        {([
          ['twitch', 'Twitch', 'https://twitch.tv/seu-canal'],
          ['youtube', 'YouTube', 'https://youtube.com/@seu-canal'],
          ['instagram', 'Instagram', 'https://instagram.com/seu-perfil'],
          ['twitter', 'Twitter / X', 'https://x.com/seu-perfil'],
          ['tiktok', 'TikTok', 'https://tiktok.com/@seu-perfil'],
        ] as const).map(([key, label, placeholder]) => (
          <div key={key}>
            <label className="block text-sm text-zinc-400 mb-2">{label}</label>
            <input
              type="url"
              value={socialLinks[key] || ''}
              onChange={e => updateSocialLink(key, e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      {/* Messages & Save */}
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
        className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Alteracoes
      </button>
    </div>
  )
}
