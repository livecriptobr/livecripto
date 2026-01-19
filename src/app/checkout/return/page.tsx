import Link from 'next/link'

interface Props {
  searchParams: Promise<{ status?: string; id?: string }>
}

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const params = await searchParams
  const { status } = params

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center max-w-md">
        {status === 'success' ? (
          <>
            <h1 className="text-2xl font-bold text-green-400 mb-4">Pagamento confirmado!</h1>
            <p className="text-zinc-400">Obrigado pela sua doacao!</p>
          </>
        ) : status === 'failure' ? (
          <>
            <h1 className="text-2xl font-bold text-red-400 mb-4">Pagamento falhou</h1>
            <p className="text-zinc-400">Houve um problema com seu pagamento.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-yellow-400 mb-4">Pagamento pendente</h1>
            <p className="text-zinc-400">Aguardando confirmacao do pagamento.</p>
          </>
        )}
        <Link href="/" className="inline-block mt-6 text-purple-500 hover:text-purple-400">
          Voltar ao inicio
        </Link>
      </div>
    </main>
  )
}
