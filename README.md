# LiveCripto

Plataforma de doacoes para streamers com PIX, Cartao e Lightning Network.

## Tecnologias

- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Estilizacao**: Tailwind CSS
- **Autenticacao**: Clerk
- **Banco de Dados**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Pagamentos**: OpenPix (PIX), MercadoPago (Cartao), Coinsnap (Lightning)
- **TTS**: Google Cloud Text-to-Speech
- **Storage**: Bunny CDN

## Features

- Doacoes via PIX, Cartao de Credito e Bitcoin Lightning
- Overlay para OBS com alertas animados
- Text-to-Speech das mensagens de doacao
- Dashboard completo para streamers
- Sistema de saldo e saques
- Configuracoes personalizaveis de alertas

## Instalacao

### Pre-requisitos

- Node.js 18+
- pnpm
- Conta Clerk
- Projeto Supabase (PostgreSQL)
- Contas nos providers de pagamento

### Setup

1. Clone o repositorio:
```bash
git clone https://github.com/seu-usuario/livecripto.git
cd livecripto
```

2. Instale as dependencias:
```bash
pnpm install
```

3. Configure as variaveis de ambiente:
```bash
cp .env.example .env.local
# Edite .env.local com suas credenciais
```

4. Configure o banco de dados:
```bash
pnpm prisma generate
pnpm prisma db push
```

5. Inicie o servidor de desenvolvimento:
```bash
pnpm dev
```

## Variaveis de Ambiente

| Variavel | Descricao |
|----------|-----------|
| `NEXT_PUBLIC_APP_URL` | URL publica do app (ex: https://livecripto.net) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Secret para validar webhooks do Clerk |
| `DATABASE_URL` | URL de conexao PostgreSQL (Supabase) |
| `OPENPIX_APP_ID` | App ID do OpenPix |
| `OPENPIX_WEBHOOK_SECRET` | Secret do webhook OpenPix |
| `COINSNAP_API_KEY` | API key do Coinsnap |
| `COINSNAP_STORE_ID` | Store ID do Coinsnap |
| `COINSNAP_WEBHOOK_SECRET` | Secret do webhook Coinsnap |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token do MercadoPago |
| `GOOGLE_TTS_API_KEY` | API key do Google Cloud TTS |
| `BUNNY_STORAGE_HOST` | Host do Bunny Storage |
| `BUNNY_STORAGE_ZONE` | Nome da zona de storage |
| `BUNNY_STORAGE_KEY` | API key do storage |
| `BUNNY_CDN_HOST` | Host do CDN publico |
| `INTERNAL_API_SECRET` | Secret para APIs internas |
| `CRON_SECRET` | Secret para cron jobs |

## Configuracao dos Webhooks

### Clerk
- URL: `https://seu-dominio.com/api/webhooks/clerk`
- Eventos: `user.created`, `user.updated`, `user.deleted`

### OpenPix
- URL: `https://seu-dominio.com/api/webhooks/openpix`
- Evento: `OPENPIX:CHARGE_COMPLETED`

### Coinsnap
- URL: `https://seu-dominio.com/api/webhooks/coinsnap`
- Eventos: `InvoiceSettled`, `InvoiceExpired`

### MercadoPago
- URL: `https://seu-dominio.com/api/webhooks/mercadopago`
- Eventos: `payment`

## Configuracao do OBS

1. Adicione uma **Browser Source**
2. Configure:
   - URL: `https://seu-dominio.com/overlay/{username}?token={overlayToken}`
   - Largura: 800
   - Altura: 600
   - Marque "Shutdown source when not visible"
3. O token esta disponivel no Dashboard > Controles

## Cron Jobs

Configure um scheduler (Vercel Cron, GitHub Actions, etc.) para chamar:

```bash
# Limpeza de audios expirados (a cada hora)
curl -X POST https://seu-dominio.com/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Deploy

### Vercel (recomendado)

1. Conecte o repositorio ao Vercel
2. Configure todas as variaveis de ambiente
3. Deploy automatico a cada push

### Docker (alternativa)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

## Estrutura do Projeto

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Paginas de autenticacao
│   ├── (dashboard)/       # Dashboard do streamer
│   ├── (public)/          # Paginas publicas
│   ├── api/               # API Routes
│   └── checkout/          # Retorno de pagamento
├── components/            # Componentes React
│   ├── dashboard/         # Componentes do dashboard
│   ├── donate/            # Componentes de doacao
│   ├── overlay/           # Componentes do overlay
│   └── ui/                # Componentes genericos
├── lib/                   # Utilitarios e integracoes
│   ├── payments/          # Clients de pagamento
│   └── ...
├── services/              # Logica de negocio
└── types/                 # Definicoes TypeScript
```

## Troubleshooting

### Webhook nao processa
- Verifique se a URL esta correta e acessivel
- Confirme o secret/signature
- Verifique os logs do servidor

### Overlay nao exibe alertas
- Confirme o token na URL
- Verifique se ha alerts com status READY
- Abra o console do navegador para erros

### TTS nao gera audio
- Verifique a API key do Google TTS
- Confirme credenciais do Bunny CDN
- Veja logs em `/api/internal/tts/build`

## Licenca

MIT
