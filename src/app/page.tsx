import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-6">
          LiveCripto
        </h1>
        <p className="text-xl text-zinc-400 mb-8">
          Receba doacoes via PIX, Cartao e Lightning Network
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Criar Conta
          </Link>
          <Link
            href="/sign-in"
            className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  )
}
