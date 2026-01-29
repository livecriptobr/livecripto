'use client'

import { CreditCard, Clock } from 'lucide-react'

export default function ReceivablesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Recebiveis</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <span className="text-zinc-400 text-sm">Total Pendente</span>
          </div>
          <p className="text-2xl font-bold text-white">R$ 0,00</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-zinc-400 text-sm">Proximo Recebimento</span>
          </div>
          <p className="text-2xl font-bold text-zinc-500">-</p>
        </div>
      </div>

      {/* Empty State */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center">
        <CreditCard className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
        <h2 className="text-lg font-semibold text-zinc-400 mb-2">Nenhum recebivel pendente</h2>
        <p className="text-zinc-500 text-sm max-w-md mx-auto">
          Recebiveis aparecem quando voce recebe doacoes via cartao de credito.
          Os valores ficam disponiveis apos o periodo de compensacao.
        </p>
      </div>
    </div>
  )
}
