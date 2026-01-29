import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { MessagesInbox } from './messages-inbox'

export default async function Page() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mensagens</h1>
      <p className="text-zinc-400">Histórico de mensagens recebidas nas doações.</p>
      <MessagesInbox />
    </div>
  )
}
