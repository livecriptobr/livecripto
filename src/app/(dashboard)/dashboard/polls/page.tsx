import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import PollsDashboard from './PollsDashboard'

export default async function PollsPage() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, username: true },
  })

  if (!user) redirect('/sign-in')

  return <PollsDashboard username={user.username} />
}
