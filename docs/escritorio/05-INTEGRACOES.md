# Integrações externas

Cada integração tem estado verificável na Central de Integrações: **não configurada → configurada → testada (data do último teste) → com erro (mensagem)**. Nunca exibir "conectada" sem teste bem-sucedido.

| Integração | O que é preciso | Permissões mínimas | Custos (verificar tabela vigente) |
|---|---|---|---|
| **Meta Ads** (Marketing API) | App no Meta for Developers, Business Manager verificado, conta de anúncios da Julia vinculada, token de sistema | `ads_read` (fase 1); `ads_management` só depois, separado | API sem custo; verba dos anúncios é da conta da Julia |
| **WhatsApp** (Cloud API) | Conta WhatsApp Business no Business Manager, número dedicado, templates aprovados, webhook HTTPS | `whatsapp_business_messaging`, `whatsapp_business_management` | Cobrança por mensagem de template (marketing > utilidade); respostas dentro da janela de 24h têm regras próprias |
| **Google Sheets** | Projeto Google Cloud, conta de serviço, planilha compartilhada só com essa conta | Escopo `spreadsheets` restrito à planilha | Gratuito dentro das cotas |
| **Canva** | Conector Canva autorizado pela conta da Julia/RB | Leitura/criação de designs | Alguns recursos (modelos de marca, autopreenchimento) exigem planos pagos do Canva |
| **Vercel** | Projeto existente `julia-santos-epil` | Variáveis só em Production/Preview conforme necessário | Crons de hora em hora exigem plano Pro |
| **GitHub** | Repositório `oficialraphaelbruno-pixel/Julia-Santos-Epil` | Proteção da branch `main` recomendada | — |
| **Anthropic** (IA do escritório web) | Chave de API em conta contratada, limite de gasto | Chave só no servidor | Por tokens; limite mensal configurável no sistema |

## Segurança
- Tokens e segredos: somente variáveis de ambiente do servidor (Vercel), tipo "sensitive".
- Tokens OAuth armazenados criptografados (padrão já usado em `google_calendar_connections` com `INTEGRATIONS_ENCRYPTION_KEY`).
- Webhooks: verificação de assinatura, resposta rápida, processamento idempotente, registro de falhas com tentativas limitadas.

## Variáveis novas (nomes em `.env.example`)
`META_APP_ID`, `META_APP_SECRET`, `META_AD_ACCOUNT_ID`, `META_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`, `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`.

Já existentes e reaproveitadas: `WHATSAPP_CLOUD_API_TOKEN` (equivale a `WHATSAPP_ACCESS_TOKEN`), `WHATSAPP_PHONE_NUMBER_ID`.
