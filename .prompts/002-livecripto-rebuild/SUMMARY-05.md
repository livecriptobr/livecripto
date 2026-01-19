# FASE 5 - TTS + Bunny CDN

## Resumo
Implementacao completa do sistema de Text-to-Speech (TTS) usando Google Cloud TTS API com upload de audio para Bunny CDN. O sistema gera audio automaticamente quando uma doacao e paga, armazena no CDN, e o overlay reproduz o audio durante a exibicao do alerta.

## Arquivos Criados

### Bibliotecas de Suporte (src/lib/)

- **tts.ts** - Funcoes para geracao de audio TTS:
  - `generateTTS({ text, voice, languageCode })` - Gera audio via Google Cloud TTS API:
    - Trunca texto para maximo de 5000 caracteres
    - Configuravel: voz, idioma, encoding MP3
    - Retorna Buffer com audio MP3
  - `buildTTSText(template, donation)` - Monta texto usando template:
    - Substitui variaveis: {nome}, {valor}, {mensagem}
    - Formata valor em R$ com Intl.NumberFormat
  - `applyBlacklist(text, blockedWords)` - Filtra palavras bloqueadas:
    - Substitui palavras da blacklist por "censurado"
    - Case insensitive, word boundaries

- **bunny.ts** - Funcoes para Bunny CDN Storage:
  - `uploadToBunny({ path, content, contentType })` - Upload de arquivo:
    - Usa API REST do Bunny Storage
    - Retorna URL publica do CDN
  - `deleteFromBunny(path)` - Remove arquivo do storage:
    - Ignora erro 404 (arquivo ja deletado)
  - `getPathFromUrl(url)` - Extrai path de URL do CDN:
    - Util para cleanup de arquivos

### API Endpoints - Internal (src/app/api/internal/)

- **tts/build/route.ts** - POST - Gera audio TTS para alerta:
  - Autenticacao via INTERNAL_API_SECRET
  - Body: { alertId }
  - Fluxo:
    1. Busca alert com donation e user.alertSettings
    2. Verifica se TTS esta habilitado
    3. Monta texto usando template do usuario
    4. Aplica blacklist de palavras
    5. Gera audio via Google TTS
    6. Upload para Bunny CDN (path: tts/{userId}/{alertId}.mp3)
    7. Atualiza alert com audioUrl e status READY
  - Em caso de erro: marca como READY com lastError (exibe sem audio)

### API Endpoints - Cron (src/app/api/cron/)

- **cleanup/route.ts** - POST - Limpa audios antigos:
  - Autenticacao via CRON_SECRET
  - TTL de 6 horas apos consumo
  - Busca alerts DONE com audioUrl e consumedAt < cutoff
  - Remove arquivo do Bunny CDN
  - Limpa audioUrl no banco
  - Retorna estatisticas: { deleted, errors, total, ttlHours }

### API Endpoints - Private (src/app/api/private/)

- **alert-settings/route.ts** - GET/POST - Configuracoes de alerta:
  - GET: Retorna alertSettings do usuario autenticado
  - POST: Atualiza alertSettings do usuario
  - Autenticacao via Clerk

### Dashboard Pages (src/app/(dashboard)/dashboard/)

- **alerts/page.tsx** - Pagina de configuracoes de TTS:
  - Toggle TTS on/off
  - Selecao de voz (Standard A/B/C, Wavenet A/B)
  - Template customizavel com variaveis
  - Slider de duracao (3-20 segundos)
  - Valor minimo para alerta
  - Lista de palavras bloqueadas (separadas por virgula)
  - Feedback visual de loading e sucesso/erro

### Servico de Doacao Atualizado (src/services/)

- **donation.service.ts** - Adicionado trigger de TTS:
  - `triggerTTSBuild(alertId)` - Chama API interna para gerar audio
  - `handleDonationPaid()` - Apos transacao, dispara TTS non-blocking:
    - Nao bloqueia resposta do webhook
    - Erros sao logados mas nao afetam fluxo principal

## Fluxo Completo TTS

1. Webhook de pagamento chama `handleDonationPaid()`
2. Transacao cria Donation (PAID), Ledger, Alert (QUEUED)
3. Apos transacao, dispara `triggerTTSBuild(alertId)` non-blocking
4. API /internal/tts/build:
   - Busca configuracoes do usuario
   - Monta texto com template + blacklist
   - Gera audio via Google TTS
   - Upload para Bunny CDN
   - Atualiza alert: audioUrl + status READY
5. Overlay busca alert com audioUrl
6. AlertBox reproduz audio durante exibicao
7. Cron de cleanup remove audios apos 6h

## Variaveis de Ambiente Necessarias

```env
# Google Cloud TTS
GOOGLE_TTS_API_KEY=your-google-api-key

# Bunny CDN Storage
BUNNY_STORAGE_HOST=storage.bunnycdn.com
BUNNY_STORAGE_ZONE=your-zone-name
BUNNY_STORAGE_KEY=your-storage-api-key
BUNNY_CDN_HOST=your-pull-zone.b-cdn.net

# Internal APIs
INTERNAL_API_SECRET=random-secret-for-internal-calls
CRON_SECRET=random-secret-for-cron-jobs
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Configuracoes do Usuario (alertSettings JSON)

```typescript
interface AlertSettings {
  minAmountCents: number      // Valor minimo para gerar alerta
  ttsEnabled: boolean         // TTS habilitado
  ttsVoice: string           // Voz do Google TTS
  ttsTemplate: string        // Template com {nome}, {valor}, {mensagem}
  durationMs: number         // Duracao do alerta em ms
  blockedWords: string[]     // Palavras a censurar
}
```

## Vozes Disponiveis (pt-BR)

| Valor | Label |
|-------|-------|
| pt-BR-Standard-A | Feminina (Standard A) |
| pt-BR-Standard-B | Masculina (Standard B) |
| pt-BR-Standard-C | Feminina (Standard C) |
| pt-BR-Wavenet-A | Feminina Natural (Wavenet A) |
| pt-BR-Wavenet-B | Masculina Natural (Wavenet B) |

## Funcionalidades Implementadas

- [x] Geracao de audio via Google Cloud TTS API
- [x] Upload automatico para Bunny CDN
- [x] Template customizavel para mensagem TTS
- [x] Blacklist de palavras com censura
- [x] Selecao de voz (Standard e Wavenet)
- [x] Trigger non-blocking apos pagamento
- [x] Fallback graceful (exibe sem audio em caso de erro)
- [x] Cleanup automatico de audios antigos
- [x] Dashboard de configuracoes de alerta
- [x] API de configuracoes do usuario

## Proximos Passos (Fase 6)

- Sistema de saque/payout
- Ledger completo com debitos
- Integracao com pagamento de saques
- Dashboard financeiro

## Dependencias

- Google Cloud Text-to-Speech API
- Bunny CDN (Storage Zone + Pull Zone)
- @clerk/nextjs (autenticacao)
- @prisma/client (banco de dados)
- lucide-react (icones)
