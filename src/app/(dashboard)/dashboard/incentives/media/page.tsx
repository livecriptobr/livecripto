import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { MediaGallery } from './media-gallery'

export default async function Page() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mídia</h1>
      <p className="text-zinc-400">Galeria de GIFs e imagens enviados com doações.</p>
      <MediaGallery />
    </div>
  )
}
