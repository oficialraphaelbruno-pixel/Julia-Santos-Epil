# Assistente virtual Mel — como ligar

A Mel já está pronta no site, mas **só aparece** quando as duas condições abaixo são verdadeiras:

1. A chave da OpenAI está cadastrada na Vercel (`OPENAI_API_KEY`).
2. A chave "Assistente ligada" está ativada no painel (FAQ e assistente Mel).

## 1. Criar a chave na OpenAI

1. Entre em https://platform.openai.com com a conta em que você acompanha os créditos.
2. Menu **API keys** → **Create new secret key**.
3. Nome: `site-julia-santos` (pode ser qualquer um). Projeto: o padrão.
4. Clique em **Create secret key** e **copie a chave** (começa com `sk-`). Ela só aparece uma vez.
5. Não mande a chave por WhatsApp, e-mail nem no chat: ela vai direto para a Vercel.

Recomendado em **Settings → Limits** (ou Billing): defina um limite mensal de gasto (ex.: US$ 10). Assim, nunca passa disso.

## 2. Colocar a chave na Vercel

1. https://vercel.com → projeto **julia-santos-epil** → **Settings** → **Environment Variables**.
2. **Key**: `OPENAI_API_KEY` · **Value**: cole a chave `sk-...` · ative **Sensitive** · ambiente **Production** (e Preview, se quiser).
3. **Save**.
4. Vá em **Deployments**, no último deploy clique nos três pontinhos → **Redeploy** (a chave só vale depois de publicar de novo).

## 3. Ligar no painel

1. Painel → **FAQ e assistente Mel**.
2. O aviso amarelo "Falta a chave da OpenAI" deve ter sumido.
3. Ative **Assistente ligada** → **Salvar assistente**. Aparece "No ar".
4. Abra o site no celular: o balão da Mel fica no canto inferior direito da página inicial e da página Dúvidas.

## O que a Mel sabe

- Serviços, preços e duração (Serviços).
- Cuidados antes e depois de cada serviço (Serviços → orientações).
- Sinal, prazo e chave Pix (Agendamento Online).
- Política de cancelamento e remarcação (Agendamento Online).
- Endereço e horários (Configurações).
- As perguntas escritas no FAQ e o campo "Informações extras" da assistente.

Ela **não inventa**: se não estiver cadastrado, diz que não sabe e oferece o WhatsApp. Perguntas de saúde são sempre encaminhadas para a Julia. As perguntas que ela não soube responder aparecem no painel para virar resposta no FAQ.

## Custos e proteções

- Modelo padrão: `gpt-4o-mini` (rápido e barato). Só o administrador geral pode trocar, no painel.
- Limite de mensagens por dia (padrão 300), configurável no painel.
- Limite por visitante: 8 mensagens por minuto e 40 por hora.
- Cada mensagem envia para a OpenAI as informações do studio (cerca de 4 a 6 mil "tokens"). Confira os preços atuais em https://openai.com/api/pricing. Com um modelo "mini", o custo por mensagem fica em frações de centavo de dólar.
- Perguntas guardadas no painel por no máximo 90 dias, sem identificar a visitante (números longos e e-mails são apagados do registro).

## Teste local

O teste `npm run test:e2e:faq-mel` usa uma OpenAI simulada. Inicie o site com:

```
OPENAI_API_KEY=teste-local OPENAI_BASE_URL=http://127.0.0.1:4555/v1 npm start
```
