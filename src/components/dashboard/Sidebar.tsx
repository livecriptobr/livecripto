'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Wallet,
  ArrowDownToLine,
  Clock,
  Receipt,
  ArrowUpFromLine,
  Gauge,
  MessageSquare,
  Image as ImageIcon,
  BarChart3,
  Target,
  Heart,
  Gift,
  CreditCard,
  Layout,
  Settings,
  User,
  Megaphone,
  ShieldCheck,
  Link2,
  Shield,
  Lock,
  UserCog,
  Monitor,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface SidebarProps {
  displayName: string
  username: string
  imageUrl?: string
  onMobileClose?: () => void
}

interface NavSection {
  label: string
  icon: React.ReactNode
  href?: string
  children?: { label: string; href: string; icon: React.ReactNode }[]
}

const navSections: NavSection[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/dashboard' },
  {
    label: 'Carteira',
    icon: <Wallet size={20} />,
    children: [
      { label: 'Sacar', href: '/dashboard/wallet/withdraw', icon: <ArrowDownToLine size={18} /> },
      { label: 'Histórico', href: '/dashboard/history', icon: <Clock size={18} /> },
      { label: 'Recebíveis', href: '/dashboard/wallet/receivables', icon: <Receipt size={18} /> },
      { label: 'Saques', href: '/dashboard/payouts', icon: <ArrowUpFromLine size={18} /> },
      { label: 'Limites', href: '/dashboard/wallet/limits', icon: <Gauge size={18} /> },
    ],
  },
  {
    label: 'Incentivos',
    icon: <Megaphone size={20} />,
    children: [
      { label: 'Mensagens', href: '/dashboard/incentives/messages', icon: <MessageSquare size={18} /> },
      { label: 'Mídia', href: '/dashboard/incentives/media', icon: <ImageIcon size={18} /> },
    ],
  },
  { label: 'Enquetes', icon: <BarChart3 size={20} />, href: '/dashboard/polls' },
  { label: 'Vaquinhas', icon: <Target size={20} />, href: '/dashboard/goals' },
  { label: 'Ações Solidárias', icon: <Heart size={20} />, href: '/dashboard/charity' },
  { label: 'Recompensas', icon: <Gift size={20} />, href: '/dashboard/rewards' },
  { label: 'Planos', icon: <CreditCard size={20} />, href: '/dashboard/plans' },
  { label: 'Widgets', icon: <Layout size={20} />, href: '/dashboard/widgets' },
  {
    label: 'Configurações',
    icon: <Settings size={20} />,
    children: [
      { label: 'Perfil', href: '/dashboard/profile', icon: <User size={18} /> },
      { label: 'Incentivos', href: '/dashboard/settings/incentives', icon: <Megaphone size={18} /> },
      { label: 'Verificações', href: '/dashboard/settings/verifications', icon: <ShieldCheck size={18} /> },
      { label: 'Conexões', href: '/dashboard/settings/connections', icon: <Link2 size={18} /> },
      { label: 'Moderação', href: '/dashboard/settings/moderation', icon: <Shield size={18} /> },
      { label: 'Controle Remoto', href: '/dashboard/controls', icon: <Monitor size={18} /> },
      { label: 'Segurança', href: '/dashboard/settings/security', icon: <Lock size={18} /> },
      { label: 'Minha Conta', href: '/dashboard/settings/account', icon: <UserCog size={18} /> },
    ],
  },
]

export default function Sidebar({ displayName, username, imageUrl, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem('sidebar-sections')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev: boolean) => {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(!prev))
      return !prev
    })
  }, [])

  const toggleSection = useCallback((label: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [label]: !prev[label] }
      localStorage.setItem('sidebar-sections', JSON.stringify(next))
      return next
    })
  }, [])

  const isActive = (href: string) => pathname === href
  const isSectionActive = (section: NavSection) => {
    if (section.href) return isActive(section.href)
    return section.children?.some(c => pathname.startsWith(c.href)) ?? false
  }

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      style={{ backgroundColor: '#1a1f36' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">
            {displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-zinc-400 truncate">@{username}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navSections.map(section => {
          const active = isSectionActive(section)

          if (section.href) {
            return (
              <Link
                key={section.label}
                href={section.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {section.icon}
                {!collapsed && <span>{section.label}</span>}
              </Link>
            )
          }

          return (
            <div key={section.label}>
              <button
                onClick={() => !collapsed ? toggleSection(section.label) : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${
                  active
                    ? 'text-purple-400'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {section.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${openSections[section.label] ? 'rotate-180' : ''}`}
                    />
                  </>
                )}
              </button>
              {!collapsed && (
                <AnimatePresence>
                  {openSections[section.label] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5 py-1">
                        {section.children?.map(child => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onMobileClose}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              isActive(child.href)
                                ? 'bg-purple-600/20 text-purple-400'
                                : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            {child.icon}
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="flex items-center justify-center p-3 border-t border-white/10 text-zinc-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  )
}
