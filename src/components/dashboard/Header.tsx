'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, ChevronRight } from 'lucide-react'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  onMenuClick: () => void
}

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  wallet: 'Carteira',
  withdraw: 'Sacar',
  history: 'Histórico',
  receivables: 'Recebíveis',
  payouts: 'Saques',
  limits: 'Limites',
  incentives: 'Incentivos',
  messages: 'Mensagens',
  media: 'Mídia',
  polls: 'Enquetes',
  goals: 'Vaquinhas',
  charity: 'Ações Solidárias',
  rewards: 'Recompensas',
  plans: 'Planos',
  widgets: 'Widgets',
  settings: 'Configurações',
  profile: 'Perfil',
  verifications: 'Verificações',
  connections: 'Conexões',
  moderation: 'Moderação',
  controls: 'Controle Remoto',
  security: 'Segurança',
  account: 'Minha Conta',
  alerts: 'Alertas',
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const breadcrumbs = segments.map((seg, i) => ({
    label: routeLabels[seg] || seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-zinc-400 hover:text-white">
          <Menu size={22} />
        </button>
        <nav className="hidden sm:flex items-center gap-1 text-sm">
          {breadcrumbs.map((bc, i) => (
            <span key={bc.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-zinc-600" />}
              {i === breadcrumbs.length - 1 ? (
                <span className="text-zinc-300">{bc.label}</span>
              ) : (
                <Link href={bc.href} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {bc.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-red-600/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-600/30 transition-colors">
          PULAR ALERTA
        </button>
        <NotificationBell />
      </div>
    </header>
  )
}
