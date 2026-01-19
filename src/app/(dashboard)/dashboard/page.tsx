import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { userService } from '@/services/user.service'
import { UserButton } from '@clerk/nextjs'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const clerkUser = await currentUser()
  const user = await userService.getOrCreateUser(
    userId,
    clerkUser?.emailAddresses[0]?.emailAddress || '',
    clerkUser?.firstName || undefined
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Link Publico */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">Seu link de doacao</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-800 px-4 py-2 rounded-lg text-purple-400 text-sm">
              {appUrl}/{user.username}
            </code>
            <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm transition-colors">
              Copiar
            </button>
          </div>
        </div>

        {/* Overlay URL */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">URL do Overlay (OBS)</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-800 px-4 py-2 rounded-lg text-green-400 text-sm truncate">
              {appUrl}/overlay/{user.username}?token={user.overlayToken.slice(0, 8)}...
            </code>
            <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm transition-colors">
              Copiar
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Adicione como Browser Source no OBS (800x600)
          </p>
        </div>
      </div>

      {/* User Info */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-300 mb-4">Suas informacoes</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-zinc-500">Username</dt>
            <dd className="text-lg font-medium">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Nome de exibicao</dt>
            <dd className="text-lg font-medium">{user.displayName || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Email</dt>
            <dd className="text-lg font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Doacao minima</dt>
            <dd className="text-lg font-medium">
              R$ {((user.alertSettings as any)?.minAmountCents || 100) / 100}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
