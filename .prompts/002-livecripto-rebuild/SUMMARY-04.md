# FASE 4 - Sistema de Alertas e Overlay OBS

## Resumo
Implementacao completa do sistema de alertas em tempo real para overlay OBS, incluindo servico de gerenciamento de alertas com lock pattern, overlay page com polling, componente de alerta animado, e controles ao vivo para o streamer.

## Arquivos Criados

### Servico de Alertas (src/services/)

- **alert.service.ts** - Servico central de gerenciamento de alertas:
  - `getNextReadyAlert(userId)` - Busca e trava proximo alerta usando lock atomico:
    - Query raw SQL para UPDATE atomico com FOR UPDATE SKIP LOCKED
    - Lock expira em 60 segundos
    - Processa alertas READY, QUEUED ou LOCKED expirados
  - `acknowledgeAlert(alertId)` - Marca alerta como DONE apos exibicao
  - `skipAlert(alertId)` - Marca alerta como SKIPPED
  - `getLastDoneAlert(userId)` - Busca ultimo alerta exibido
  - `replayLastAlert(userId)` - Cria novo alerta replicando o ultimo
  - `unlockExpiredAlerts()` - Libera locks expirados
  - `getCurrentLockedAlert(userId)` - Busca alerta atualmente travado

### Overlay Page (src/app/(public)/overlay/[username]/)

- **page.tsx** - Pagina de overlay para OBS Browser Source:
  - URL: `/overlay/{username}?token={overlayToken}`
  - Polling a cada 1 segundo para buscar alertas
  - Validacao de token via query param
  - Gerenciamento de estado do alerta atual
  - Referencia de audio para TTS
  - Handlers para inicio e fim de alerta
  - Background transparente para composicao em OBS

### Componente de Alerta (src/components/overlay/)

- **AlertBox.tsx** - Componente visual do alerta com animacoes:
  - Animacoes com Framer Motion (spring, fade, scale)
  - Gradiente roxo/violeta com glow effect
  - Exibe: titulo "Nova doacao!", nome do doador, valor formatado, mensagem
  - Auto-hide apos duracao configuravel (default 8s)
  - Play de audio se audioUrl existir
  - Transicao de saida com delay de 600ms

### API Endpoints - Overlay (src/app/api/overlay/)

- **next/route.ts** - GET - Busca proximo alerta:
  - Params: username, token
  - Valida overlayToken do usuario
  - Retorna dados formatados: id, donorName, amountCents, message, audioUrl, durationMs
  - DurationMs configuravel via alertSettings do usuario

- **ack/route.ts** - POST - Confirma exibicao do alerta:
  - Body: alertId, token
  - Valida token antes de confirmar
  - Marca alerta como DONE

### API Endpoints - Private (src/app/api/private/)

- **alerts/skip/route.ts** - POST - Pula alerta especifico:
  - Autenticacao via Clerk
  - Body: alertId
  - Verifica propriedade do alerta

- **alerts/skip-current/route.ts** - POST - Pula alerta atual:
  - Autenticacao via Clerk
  - Busca alerta LOCKED do usuario
  - Marca como SKIPPED

- **alerts/replay/route.ts** - POST - Reexibe ultimo alerta:
  - Autenticacao via Clerk
  - Cria novo alerta baseado no ultimo DONE
  - Copia audioUrl se existir

- **rotate-token/route.ts** - POST - Rotaciona token do overlay:
  - Autenticacao via Clerk
  - Gera novo token com crypto.randomBytes(32)
  - Atualiza overlayTokenUpdatedAt

### Dashboard Controls (src/app/(dashboard)/dashboard/controls/)

- **page.tsx** - Pagina de controles ao vivo:
  - Botao "Pular Alerta" - Pula alerta atual em exibicao
  - Botao "Reexibir Ultimo" - Reexibe ultimo alerta
  - Botao "Rotacionar Token" - Invalida token atual
  - Feedback visual de loading e mensagens de sucesso/erro
  - Icons do Lucide (SkipForward, RotateCcw, RefreshCw, Loader2)

## Fluxo do Sistema de Alertas

1. Doacao e paga -> donation.service cria Alert com status QUEUED
2. Overlay page faz polling em /api/overlay/next a cada 1s
3. alertService.getNextReadyAlert() trava alerta atomicamente (LOCKED)
4. Overlay exibe AlertBox com animacao e audio
5. Apos duracao, overlay chama /api/overlay/ack
6. alertService.acknowledgeAlert() marca como DONE
7. Polling continua buscando proximo alerta

## Lock Pattern

O sistema usa um padrao de lock pessimista para garantir que:
- Cada alerta e exibido apenas uma vez
- Multiplas janelas de overlay nao duplicam alertas
- Locks expirados sao automaticamente liberados
- Operacao atomica via FOR UPDATE SKIP LOCKED do PostgreSQL

## Uso no OBS

1. Adicionar Browser Source no OBS
2. URL: `https://seusite.com/overlay/{username}?token={overlayToken}`
3. Dimensoes recomendadas: 800x600 ou similar
4. Marcar "Shutdown source when not visible" para economia

## Funcionalidades Implementadas

- [x] Servico de alertas com lock pattern atomico
- [x] Overlay page com polling de 1s
- [x] AlertBox com animacoes Framer Motion
- [x] Suporte a audio/TTS no alerta
- [x] Validacao de overlayToken
- [x] Controles ao vivo (pular, replay, rotate)
- [x] Dashboard de controles para streamer
- [x] API de acknowledgeAlert
- [x] API de skipAlert (especifico e atual)
- [x] API de replayLastAlert
- [x] API de rotateToken
- [x] Duracao configuravel via alertSettings

## Proximos Passos (Fase 5)

- Integracao com TTS (Text-to-Speech)
- Upload de audio para Bunny CDN
- Fila de processamento de audio
- Configuracoes avancadas de alerta

## Dependencias

- framer-motion (animacoes)
- lucide-react (icones)
- @clerk/nextjs (autenticacao)
- @prisma/client (banco de dados)
- crypto (nativo Node.js)
