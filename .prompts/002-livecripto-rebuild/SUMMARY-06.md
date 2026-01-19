# FASE 6 - Payout Requests + Ledger

## Resumo
Implementacao completa do sistema de saques (payouts) com gerenciamento de saldo via Ledger. O streamer pode configurar sua chave PIX ou Lightning Address, visualizar seu saldo disponivel, solicitar saques, e acompanhar o historico de doacoes e saques.

## Arquivos Criados

### Services (src/services/)

- **ledger.service.ts** - Gerenciamento de saldo e transacoes:
  - `getBalance(userId)` - Calcula saldo disponivel:
    - Agrupa entradas por tipo (CREDIT/DEBIT)
    - Retorna diferenca (credits - debits) em centavos
  - `getTransactions(userId, limit, offset)` - Lista transacoes:
    - Paginacao com limit/offset
    - Ordenado por data decrescente
  - `createCredit(params)` - Cria credito:
    - Sources: DONATION, ADJUSTMENT
  - `createDebit(params)` - Cria debito:
    - Sources: WITHDRAW, ADJUSTMENT

- **withdraw.service.ts** - Gerenciamento de saques:
  - `requestWithdraw({ userId, method, amountCents })` - Solicita saque:
    - Valida valor minimo (R$ 10,00)
    - Verifica saldo disponivel
    - Aplica cooldown de 1 hora entre saques
    - Valida destino configurado (PIX ou Lightning)
    - Transacao atomica: cria WithdrawRequest + debito no Ledger
    - Snapshot do destino no momento da solicitacao
  - `getWithdraws(userId)` - Lista saques do usuario
  - `cancelWithdraw(withdrawId, userId)` - Cancela saque pendente:
    - Apenas status REQUESTED pode ser cancelado
    - Estorna valor via credito ADJUSTMENT

### API Endpoints - Private (src/app/api/private/)

- **balance/route.ts** - GET - Saldo do usuario:
  - Autenticacao via Clerk
  - Retorna `{ balanceCents: number }`

- **ledger/route.ts** - GET - Historico de transacoes:
  - Query params: limit (default 50), offset (default 0)
  - Retorna `{ transactions: Ledger[] }`

- **donations/route.ts** - GET - Lista doacoes recebidas:
  - Query params: limit, offset, status (opcional)
  - Retorna `{ donations: Donation[], total: number }`
  - Inclui: donorName, message, amountCents, status, datas

- **payout-settings/route.ts** - GET/POST - Configuracoes de saque:
  - GET: Retorna pixKey e lightningAddress
  - POST: Atualiza pixKey e/ou lightningAddress
  - Validacao de formato Lightning Address

- **withdraw/route.ts** - POST - Solicita saque:
  - Body: `{ method: 'PIX'|'LIGHTNING', amountCents: number }`
  - Validacao de metodo e valor
  - Retorna `{ withdraw: WithdrawRequest }` ou erro

- **withdraws/route.ts** - GET - Lista saques do usuario:
  - Retorna `{ withdraws: WithdrawRequest[] }`
  - Ordenado por data decrescente

### Dashboard Pages (src/app/(dashboard)/dashboard/)

- **payouts/page.tsx** - Pagina de saques:
  - Card de saldo disponivel com gradiente
  - Formulario de configuracoes (PIX, Lightning Address)
  - Formulario de solicitacao de saque:
    - Input de valor em reais
    - Selector de metodo (PIX/Lightning)
    - Valor minimo: R$ 10,00
  - Historico de saques com status coloridos:
    - REQUESTED: amarelo
    - PROCESSING: azul
    - PAID: verde
    - REJECTED: vermelho
  - Feedback de sucesso/erro

- **history/page.tsx** - Historico de doacoes:
  - Cards de estatisticas:
    - Total recebido (pagina)
    - Doacoes na pagina
    - Total de doacoes
  - Filtro por status (Todos, Pagos, Pendentes, Expirados, Falhos)
  - Lista de doacoes com:
    - Nome do doador
    - Mensagem (truncada)
    - Valor e moeda
    - Provider de pagamento
    - Data e hora
    - Status colorido
  - Paginacao completa (20 itens por pagina)

## Fluxo de Saldo

### Creditos (aumentam saldo)
1. Doacao paga -> Ledger entry CREDIT/DONATION
2. Cancelamento de saque -> Ledger entry CREDIT/ADJUSTMENT

### Debitos (diminuem saldo)
1. Solicitacao de saque -> Ledger entry DEBIT/WITHDRAW
2. Ajuste manual -> Ledger entry DEBIT/ADJUSTMENT

## Fluxo de Saque

1. Usuario configura PIX ou Lightning Address
2. Usuario solicita saque (minimo R$ 10,00)
3. Sistema valida:
   - Saldo suficiente
   - Destino configurado
   - Cooldown de 1 hora
4. Transacao atomica:
   - Cria WithdrawRequest (status REQUESTED)
   - Cria Ledger DEBIT/WITHDRAW
5. Admin processa saque manualmente (Fase 7)
6. Status atualizado: PROCESSING -> PAID ou REJECTED

## Status de Saque

| Status | Descricao | Cor |
|--------|-----------|-----|
| REQUESTED | Aguardando processamento | Amarelo |
| PROCESSING | Em processamento | Azul |
| PAID | Pago com sucesso | Verde |
| REJECTED | Rejeitado/Cancelado | Vermelho |

## Status de Doacao

| Status | Descricao | Cor |
|--------|-----------|-----|
| CREATED | Criada, aguardando pagamento | Cinza |
| PENDING | Pagamento em processamento | Amarelo |
| PAID | Paga e confirmada | Verde |
| FAILED | Falhou/Cancelada | Vermelho |
| EXPIRED | Expirada | Laranja |
| REFUNDED | Estornada | Roxo |

## Validacoes Implementadas

- Valor minimo de saque: R$ 10,00
- Cooldown entre saques: 1 hora
- Formato de Lightning Address: email-like (user@wallet.com)
- Saldo deve ser >= valor do saque
- Destino (PIX ou Lightning) deve estar configurado

## Regras de Negocio

- Saque debita imediatamente do saldo (reserva)
- Cancelamento estorna valor para o saldo
- Snapshot do destino e salvo no momento da solicitacao
- Apenas saques REQUESTED podem ser cancelados
- Historico completo no Ledger para auditoria

## Estrutura do Ledger

```typescript
interface Ledger {
  id: string
  userId: string
  type: 'CREDIT' | 'DEBIT'
  source: 'DONATION' | 'WITHDRAW' | 'ADJUSTMENT'
  amountCents: number
  referenceId: string  // ID da donation ou withdraw
  createdAt: Date
}
```

## Funcionalidades Implementadas

- [x] Calculo de saldo via Ledger (credits - debits)
- [x] Configuracao de PIX e Lightning Address
- [x] Solicitacao de saque com validacoes
- [x] Cooldown de 1 hora entre saques
- [x] Historico de saques com status
- [x] Historico de doacoes com filtros
- [x] Paginacao de doacoes
- [x] Cancelamento de saque pendente
- [x] Estorno automatico no cancelamento
- [x] Dashboard de saques
- [x] Dashboard de historico

## Proximos Passos (Fase 7 - Hardening)

- Painel administrativo para processar saques
- Limites de saque diario/mensal
- Notificacoes de status de saque
- Rate limiting nas APIs
- Auditoria de acoes
- Backup e recovery

## Dependencias

- @clerk/nextjs (autenticacao)
- @prisma/client (banco de dados)
- lucide-react (icones: Wallet, ArrowUpRight, Save, Loader2, Gift, ChevronLeft, ChevronRight)

## Navegacao do Dashboard

O layout do dashboard inclui links para todas as paginas:
- Dashboard (/)
- Perfil
- Historico (doacoes)
- Saques (payouts)
- Alertas (configuracoes TTS)
- Controles (skip/replay)
