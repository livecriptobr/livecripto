import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { userService } from '@/services/user.service'
import DashboardShell from '@/components/dashboard/DashboardShell'

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

  const user = await userService.getOrCreateUser(
    userId,
    clerkUser?.emailAddresses[0]?.emailAddress || '',
    clerkUser?.firstName || undefined
  )

  return (
    <DashboardShell
      displayName={user.displayName || user.username}
      username={user.username}
      imageUrl={clerkUser?.imageUrl}
    >
      {children}
    </DashboardShell>
  )
}
