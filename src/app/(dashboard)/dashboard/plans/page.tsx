'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  X,
  Zap,
  Crown,
  Building2,
  Sparkles,
} from 'lucide-react'

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  priceNote: string
  icon: typeof Zap
  color: string
  borderColor: string
  bgGlow: string
  pixFee: string
  cardFee: string
  features: PlanFeature[]
  isCurrent: boolean
  highlight?: boolean
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: 'R$ 0',
    priceNote: '/mes',
    icon: Zap,
    color: 'text-zinc-400',
    borderColor: 'border-zinc-700',
    bgGlow: '',
    pixFee: '4,99%',
    cardFee: '6,99%',
    isCurrent: true,
    features: [
      { text: 'Alertas basicos', included: true },
      { text: '1 widget personalizado', included: true },
      { text: 'Limite saque R$ 1.000/dia', included: true },
      { text: 'Enquetes', included: false },
      { text: 'Vaquinhas', included: false },
      { text: 'Moderacao IA', included: false },
      { text: 'API StreamDeck', included: false },
      { text: 'Badge verificado', included: false },
      { text: 'Suporte prioritario', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 29,90',
    priceNote: '/mes',
    icon: Crown,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    bgGlow: 'shadow-purple-500/10 shadow-lg',
    pixFee: '2,99%',
    cardFee: '4,99%',
    isCurrent: false,
    highlight: true,
    features: [
      { text: 'Alertas basicos', included: true },
      { text: 'Todos os widgets', included: true },
      { text: 'Limite saque R$ 5.000/dia', included: true },
      { text: 'Enquetes', included: true },
      { text: 'Vaquinhas', included: true },
      { text: 'Moderacao IA', included: true },
      { text: 'API StreamDeck', included: false },
      { text: 'Badge verificado', included: false },
      { text: 'Suporte prioritario', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'R$ 79,90',
    priceNote: '/mes',
    icon: Building2,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    bgGlow: 'shadow-amber-500/10 shadow-lg',
    pixFee: '1,49%',
    cardFee: '2,99%',
    isCurrent: false,
    features: [
      { text: 'Alertas basicos', included: true },
      { text: 'Todos os widgets', included: true },
      { text: 'Limite saque R$ 50.000/dia', included: true },
      { text: 'Enquetes', included: true },
      { text: 'Vaquinhas', included: true },
      { text: 'Moderacao IA', included: true },
      { text: 'API StreamDeck', included: true },
      { text: 'Badge verificado', included: true },
      { text: 'Suporte prioritario', included: true },
    ],
  },
]

const comparisonFeatures = [
  { name: 'Taxa PIX', free: '4,99%', pro: '2,99%', business: '1,49%' },
  { name: 'Taxa Cartao', free: '6,99%', pro: '4,99%', business: '2,99%' },
  { name: 'Widgets', free: '1', pro: 'Ilimitados', business: 'Ilimitados' },
  { name: 'Limite saque/dia', free: 'R$ 1.000', pro: 'R$ 5.000', business: 'R$ 50.000' },
  { name: 'Alertas basicos', free: 'Sim', pro: 'Sim', business: 'Sim' },
  { name: 'Enquetes', free: 'Nao', pro: 'Sim', business: 'Sim' },
  { name: 'Vaquinhas', free: 'Nao', pro: 'Sim', business: 'Sim' },
  { name: 'Moderacao IA', free: 'Nao', pro: 'Sim', business: 'Sim' },
  { name: 'API StreamDeck', free: 'Nao', pro: 'Nao', business: 'Sim' },
  { name: 'Badge verificado', free: 'Nao', pro: 'Nao', business: 'Sim' },
  { name: 'Suporte prioritario', free: 'Nao', pro: 'Nao', business: 'Sim' },
]

export default function PlansPage() {
  const [toast, setToast] = useState<string | null>(null)

  const handleSubscribe = (planName: string) => {
    setToast(`Em breve - pagamento via PIX para o plano ${planName}`)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Planos de Assinatura</h1>
        <p className="text-zinc-400 mt-2">
          Escolha o plano ideal para o seu canal
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const Icon = plan.icon
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-zinc-900 border ${plan.borderColor} rounded-2xl p-6 flex flex-col ${plan.bgGlow} ${
                plan.highlight ? 'md:-mt-4 md:mb-4' : ''
              }`}
            >
              {plan.isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                    Plano Atual
                  </span>
                </div>
              )}

              {plan.highlight && !plan.isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className={`p-2 rounded-lg bg-zinc-800`}>
                  <Icon className={`w-6 h-6 ${plan.color}`} />
                </div>
                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-zinc-500 text-sm">{plan.priceNote}</span>
              </div>

              <div className="mb-4 space-y-1">
                <p className="text-sm text-zinc-400">
                  <span className="font-medium text-zinc-300">{plan.pixFee}</span> taxa PIX
                </p>
                <p className="text-sm text-zinc-400">
                  <span className="font-medium text-zinc-300">{plan.cardFee}</span> taxa cartao
                </p>
              </div>

              <div className="flex-1 space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    )}
                    <span className={feature.included ? 'text-zinc-300' : 'text-zinc-600'}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {plan.isCurrent ? (
                <button
                  disabled
                  className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-xl text-sm font-medium cursor-not-allowed"
                >
                  Plano Atual
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.name)}
                  className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                    plan.highlight
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  Assinar {plan.name}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Comparacao de Planos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-6 py-3 text-sm font-medium text-zinc-400">Recurso</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-zinc-400">Gratis</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-purple-400">Pro</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-amber-400">Business</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature, i) => (
                <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-6 py-3 text-sm text-zinc-300">{feature.name}</td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className={feature.free === 'Nao' ? 'text-zinc-600' : 'text-zinc-300'}>
                      {feature.free}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className={feature.pro === 'Nao' ? 'text-zinc-600' : 'text-purple-300'}>
                      {feature.pro}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className={feature.business === 'Nao' ? 'text-zinc-600' : 'text-amber-300'}>
                      {feature.business}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 right-6 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-xl shadow-lg text-sm z-50"
        >
          {toast}
        </motion.div>
      )}
    </div>
  )
}
