'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface DashboardShellProps {
  children: React.ReactNode
  displayName: string
  username: string
  imageUrl?: string
}

export default function DashboardShell({ children, displayName, username, imageUrl }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar displayName={displayName} username={username} imageUrl={imageUrl} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full w-64">
            <Sidebar
              displayName={displayName}
              username={username}
              imageUrl={imageUrl}
              onMobileClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
