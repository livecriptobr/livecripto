import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-zinc-300 mb-4">Usuario nao encontrado</h1>
        <p className="text-zinc-500 mb-6">O link que voce acessou nao existe ou foi removido.</p>
        <Link href="/" className="text-purple-500 hover:text-purple-400">
          Voltar para o inicio
        </Link>
      </div>
    </main>
  )
}
