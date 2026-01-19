import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { userService } from '@/services/user.service'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const clerkUser = await currentUser()

  // On-demand provisioning (fallback if webhook fails)
  const user = await userService.getOrCreateUser(
    userId,
    clerkUser?.emailAddresses[0]?.emailAddress || '',
    clerkUser?.firstName || undefined
  )

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex">
        {/* Sidebar will be added later */}
        <aside className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 p-4">
          <div className="text-xl font-bold text-purple-500 mb-8">LiveCripto</div>
          <nav className="space-y-2">
            <a href="/dashboard" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Dashboard
            </a>
            <a href="/dashboard/profile" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Perfil
            </a>
            <a href="/dashboard/history" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Historico
            </a>
            <a href="/dashboard/payouts" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Saques
            </a>
            <a href="/dashboard/alerts" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Alertas
            </a>
            <a href="/dashboard/controls" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Controles
            </a>
          </nav>
        </aside>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
