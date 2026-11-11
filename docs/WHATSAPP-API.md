# WhatsApp automático (API oficial da Meta)

O sistema já está pronto para enviar mensagens automáticas pelo WhatsApp usando a **API oficial (WhatsApp Cloud API)**. Falta criar a conta na Meta, aprovar os modelos e colocar as chaves na Vercel.

## Como funciona
- A Meta só permite que a empresa **inicie** uma conversa usando **modelos de mensagem aprovados** (templates). Por isso os textos da aba Comunicação não são enviados como estão pelo WhatsApp: os mesmos textos precisam ser cadastrados e aprovados na Meta, com as informações variáveis no lugar certo.
- Os textos da aba Comunicação continuam valendo para os **e-mails** e para os **botões manuais de WhatsApp** do painel.

| Situação | Quando sai | Modelo |
|---|---|---|
| Agendamento com sinal | logo após a cliente agendar | `sinal` |
| Agendamento sem sinal (aguardando confirmação) | logo após agendar | `recebido` |
| Confirmação | quando a Julia confirma (inclusive ao marcar "Sinal recebido") | `confirmacao` |
| Remarcação | ao remarcar (painel ou link da cliente) | `reagendamento` |
| Cancelamento | ao cancelar | `cancelamento` |
| Lembrete | na véspera, às 9h (e 2h antes, se a rotina rodar de hora em hora) | `lembrete` |

## Passo a passo
1. **Número:** escolha o número que vai enviar. O número usado na API normalmente deixa de funcionar no aplicativo comum do WhatsApp. Se a Meta oferecer a "coexistência" (usar o mesmo número no app WhatsApp Business e na API), pode usar o atual; senão, use um chip novo.
2. **Meta Business:** em business.facebook.com, crie/acesse a empresa com a conta da Julia. Cadastre uma forma de pagamento (a Meta cobra por mensagem de modelo; tabela em developers.facebook.com/docs/whatsapp/pricing).
3. **App:** em developers.facebook.com → Meus apps → Criar app → tipo **Empresa** → adicione o produto **WhatsApp** → adicione e verifique o número. Anote o **ID do número de telefone**.
4. **Token permanente:** Configurações do negócio → Usuários do sistema → crie um usuário (Admin) → Gerar token → selecione o app → permissões `whatsapp_business_messaging` e `whatsapp_business_management` → expiração **Nunca**. Copie o token (não compartilhe).
5. **Modelos:** no Gerenciador do WhatsApp → Modelos de mensagem → Criar modelo. Para cada um: categoria **Utilidade**, idioma **Português (BR)**, cole o texto abaixo. As variáveis precisam estar **nesta ordem**: `{{1}}` primeiro nome, `{{2}}` serviço, `{{3}}` data, `{{4}}` horário e, só no modelo de sinal, `{{5}}` valor do sinal. A Meta pede exemplos para cada variável (ex.: Maria, Virilha, 15/12/2026, 10:00, R$ 40,00).
6. **Vercel** (Settings → Environment Variables, Production):

| Variável | Valor |
|---|---|
| `WHATSAPP_CLOUD_API_TOKEN` | o token permanente |
| `WHATSAPP_PHONE_NUMBER_ID` | o ID do número |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `pt_BR` |
| `WHATSAPP_TEMPLATE_SINAL` | nome do modelo (ex.: `agendamento_sinal`) |
| `WHATSAPP_TEMPLATE_RECEBIDO` | ex.: `agendamento_recebido` |
| `WHATSAPP_TEMPLATE_CONFIRMACAO` | ex.: `agendamento_confirmado` |
| `WHATSAPP_TEMPLATE_REAGENDAMENTO` | ex.: `agendamento_remarcado` |
| `WHATSAPP_TEMPLATE_CANCELAMENTO` | ex.: `agendamento_cancelado` |
| `WHATSAPP_TEMPLATE_LEMBRETE` | ex.: `lembrete_atendimento` |

7. **Redeploy** na Vercel.
8. No painel → **Integrações** → WhatsApp → envie a **mensagem de teste** para o seu número. Chegou? Então ative o **envio automático**.

## Textos sugeridos para cadastrar na Meta
(iguais aos do sistema; a chave Pix fica escrita no próprio modelo)

**agendamento_sinal** (5 variáveis)
```
Olá, {{1}}! ✨ Seu horário na Julia Santos Epil está reservado.
Serviço: {{2}}
Data: {{3}}
Horário: {{4}}

Para confirmar, envie o sinal de {{5}} via Pix:
Chave (celular): (31) 99862-8886
Favorecida: Julia Caroline Pereira dos Santos
Banco: Itaú

Depois é só mandar o comprovante por aqui. 💛
```

**agendamento_recebido**
```
Olá, {{1}}! ✨ Recebemos seu pedido de agendamento na Julia Santos Epil.
Serviço: {{2}}
Data: {{3}}
Horário: {{4}}
Em breve confirmaremos seu horário. 💛
```

**agendamento_confirmado**
```
Olá, {{1}}! ✨ Seu agendamento na Julia Santos Epil foi confirmado!
Serviço: {{2}}
Data: {{3}}
Horário: {{4}}
Esperamos por você! 💛
```

**agendamento_remarcado**
```
Olá, {{1}}! ✨ Seu agendamento na Julia Santos Epil foi remarcado.
Serviço: {{2}}
Nova data: {{3}}
Novo horário: {{4}}
Esperamos por você! 💛
```

**agendamento_cancelado**
```
Olá, {{1}}! Seu agendamento na Julia Santos Epil foi cancelado.
Serviço: {{2}}
Data: {{3}}
Horário: {{4}}
Quando quiser, é só agendar um novo horário. 💛
```

**lembrete_atendimento**
```
Olá, {{1}}! 💛 Passando para lembrar do seu atendimento na Julia Santos Epil.
Serviço: {{2}}
Data: {{3}}
Horário: {{4}}
Até breve! ✨
```

## Pagamento do sinal
O Pix vai direto para a conta da Julia no Itaú (Pix estático). O banco não avisa o sistema, então a conferência é **manual**: a Julia vê o Pix no app do banco e, no painel, abre o agendamento e clica em **"Sinal recebido"**. Na hora, o sistema confirma o horário e envia a confirmação automática (e-mail e WhatsApp).
Para ficar 100% automático, é preciso um **gateway de pagamento** com Pix dinâmico e aviso automático (webhook), por exemplo Mercado Pago, Asaas, Efí ou PagBank (aceitam CPF; cobram taxa por Pix). Isso exige uma nova etapa de desenvolvimento.
