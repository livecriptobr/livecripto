# FASE 2 - Pagina Publica de Doacao

## Resumo
Implementacao completa da pagina publica de doacao do LiveCripto, permitindo que doadores acessem `/{username}` para enviar doacoes via PIX, Cartao ou Lightning.

## Arquivos Criados

### Utilitarios (src/lib/)
- **sanitize.ts** - Funcoes de sanitizacao de mensagens (remove caracteres de controle, escapa HTML)
- **rate-limit.ts** - Rate limiting em memoria para prevenir abusos
- **validation.ts** - Schemas Zod para validacao de entrada (donateInitSchema)

### Paginas Publicas (src/app/(public)/)
- **[username]/page.tsx** - Pagina principal de doacao, busca usuario pelo username
- **[username]/not-found.tsx** - Pagina 404 customizada para usuarios nao encontrados

### Componentes de Doacao (src/components/donate/)
- **DonationForm.tsx** - Formulario completo com:
  - Entrada de valor com formatacao de moeda
  - Campo de nome do doador (max 50 caracteres)
  - Campo de mensagem (max 400 caracteres)
  - Seletor de metodo de pagamento (PIX/Cartao/Lightning)
  - Estados de loading e erro
- **PixPayment.tsx** - Componente de pagamento PIX com QR Code e polling de status
- **LightningPayment.tsx** - Componente de pagamento Lightning com invoice e polling
- **CardPayment.tsx** - Placeholder para redirect de pagamento com cartao

### APIs (src/app/api/public/donate/)
- **init/route.ts** - Endpoint POST para iniciar doacao:
  - Validacao com Zod
  - Rate limiting por IP
  - Verificacao de valor minimo
  - Verificacao de palavras bloqueadas
  - Criacao de registro no banco
  - Retorno de dados de pagamento (mock)
- **status/route.ts** - Endpoint GET para verificar status de doacao

### Checkout
- **src/app/checkout/return/page.tsx** - Pagina de retorno apos pagamento com cartao

## Funcionalidades Implementadas
- [x] Pagina publica acessivel via /{username}
- [x] Formulario de doacao responsivo
- [x] 3 metodos de pagamento (PIX, Cartao, Lightning)
- [x] Sanitizacao de mensagens contra XSS
- [x] Filtro de palavras bloqueadas
- [x] Rate limiting (5 doacoes/minuto por IP/usuario)
- [x] Validacao de valor minimo configuravel
- [x] Polling automatico de status para PIX/Lightning
- [x] Feedback visual de estados (loading, erro, sucesso)

## Proximos Passos (Fase 3)
- Integracao real com OpenPix para PIX
- Integracao real com MercadoPago para cartao
- Integracao real com Coinsnap para Lightning
- Webhooks para confirmacao de pagamento
- Geracao de QR Codes reais

## Dependencias
- zod (validacao)
- lucide-react (icones)
- @prisma/client (banco de dados)
