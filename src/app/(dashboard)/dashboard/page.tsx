import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { userService } from '@/services/user.service'
import DashboardHome from './DashboardHome'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await userService.getUserByClerkId(userId)
  if (!user) redirect('/sign-in')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return <DashboardHome username={user.username} overlayToken={user.overlayToken} appUrl={appUrl} />
}
