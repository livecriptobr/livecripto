'use client'

import { Twitch, Youtube, Instagram, Twitter, Music2 } from 'lucide-react'
import Link from 'next/link'

interface SocialLinksData {
  twitch?: string
  youtube?: string
  instagram?: string
  twitter?: string
  tiktok?: string
}

interface Props {
  socialLinks: SocialLinksData
  primaryColor: string
}

const SOCIAL_CONFIG = [
  { key: 'twitch' as const, icon: Twitch, label: 'Twitch' },
  { key: 'youtube' as const, icon: Youtube, label: 'YouTube' },
  { key: 'instagram' as const, icon: Instagram, label: 'Instagram' },
  { key: 'twitter' as const, icon: Twitter, label: 'Twitter' },
  { key: 'tiktok' as const, icon: Music2, label: 'TikTok' },
]

export default function DonationPageClient({ socialLinks, primaryColor }: Props) {
  const activeLinks = SOCIAL_CONFIG.filter(s => socialLinks[s.key])

  if (activeLinks.length === 0) return null

  return (
    <div className="flex items-center gap-3">
      {activeLinks.map(({ key, icon: Icon, label }) => (
        <Link
          key={key}
          href={socialLinks[key] || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
          style={{ backgroundColor: `${primaryColor}33` }}
          title={label}
        >
          <Icon className="w-5 h-5" style={{ color: primaryColor }} />
        </Link>
      ))}
    </div>
  )
}
