import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
  // User created but used for side-effect (ensures user exists)
  await userService.getOrCreateUser(
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
            <Link href="/dashboard" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/profile" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Perfil
            </Link>
            <Link href="/dashboard/history" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Historico
            </Link>
            <Link href="/dashboard/payouts" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Saques
            </Link>
            <Link href="/dashboard/alerts" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Alertas
            </Link>
            <Link href="/dashboard/controls" className="block px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Controles
            </Link>
          </nav>
        </aside>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
