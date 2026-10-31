# Guia de integração com o Google Agenda

Situação: **implementada**, aguardando as credenciais OAuth para ser conectada. A agenda interna funciona sem ela.

Variável adicional obrigatória: `INTEGRATIONS_ENCRYPTION_KEY` (`openssl rand -hex 32`).

Depois de configurar: Painel → **Integrações** → **Conectar Google Agenda** → autorizar → **Escolher agenda** → **Sincronizar agora**.

## O que será necessário fornecer
1. Projeto no Google Cloud Console com a **Google Calendar API** ativada.
2. Tela de consentimento OAuth (tipo "Externo"; nome do app, e-mail de suporte, domínio).
3. Credencial **OAuth 2.0 Client ID** (aplicativo da Web) com redirecionamento:
   - `https://www.juliasantosepil.com.br/api/integracoes/google/callback`
   - `http://localhost:3000/api/integracoes/google/callback` (desenvolvimento)
4. Variáveis: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## Escopos utilizados (mínimos)
- `https://www.googleapis.com/auth/calendar.events` (criar/atualizar/remover eventos dos agendamentos)
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (escolher a agenda)

## Como funciona
- Tokens guardados somente no servidor, criptografados (AES-256-GCM), em tabela inacessível às usuárias.
- Tabela de vínculo `appointment_id ↔ google_event_id` e registro de falhas de sincronização.
- Horários ocupados do Google bloqueiam a agenda online; se a consulta falhar, o sistema não apresentará os horários externos como verificados.
- Sincronização unidirecional (studio → Google) + leitura de ocupado. Sincronização bidirecional completa não será prometida sem implementação e testes.

## Tela de consentimento
Enquanto o app estiver em modo "Teste" no Google Cloud, adicione o e-mail da Julia em **Usuários de teste**. Como o escopo de agenda é sensível, publicar o app para qualquer conta exige verificação do Google; para uso só da Julia, o modo de teste basta (os tokens de apps em teste expiram em 7 dias — publique o app para evitar reconexões).
