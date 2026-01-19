'use client'

import { Loader2, CreditCard } from 'lucide-react'

interface Props {
  data: {
    donationId: string
    redirectUrl?: string
  }
}

export default function CardPayment({ data }: Props) {
  // This component is mostly a placeholder since card payments
  // redirect to an external payment page (MercadoPago)
  // The redirect happens in DonationForm before this component renders

  return (
    <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <CreditCard className="w-8 h-8 text-blue-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-4">Redirecionando para pagamento...</h2>
      <div className="flex items-center justify-center gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Aguarde...</span>
      </div>
      <p className="text-sm text-zinc-500 mt-4">
        Voce sera redirecionado para a pagina de pagamento segura.
      </p>
      {data.redirectUrl && (
        <a
          href={data.redirectUrl}
          className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm"
        >
          Clique aqui se nao for redirecionado automaticamente
        </a>
      )}
    </div>
  )
}
