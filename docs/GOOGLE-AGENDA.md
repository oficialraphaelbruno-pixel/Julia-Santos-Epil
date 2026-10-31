# Guia de integração com o Google Agenda (Fase 2 — ainda não implementada)

Situação atual: **não conectada**. A agenda interna funciona sem ela. A cliente já pode adicionar o horário ao calendário pessoal (link do Google Agenda e arquivo .ics).

## O que será necessário fornecer
1. Projeto no Google Cloud Console com a **Google Calendar API** ativada.
2. Tela de consentimento OAuth (tipo "Externo"; nome do app, e-mail de suporte, domínio).
3. Credencial **OAuth 2.0 Client ID** (aplicativo da Web) com redirecionamento:
   - `https://www.juliasantosepil.com.br/api/integracoes/google/callback`
   - `http://localhost:3000/api/integracoes/google/callback` (desenvolvimento)
4. Variáveis: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## Escopos mínimos previstos
- `https://www.googleapis.com/auth/calendar.events` (criar/atualizar/remover eventos dos agendamentos)
- `https://www.googleapis.com/auth/calendar.freebusy` (consultar ocupado)
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (escolher a agenda)

## Desenho previsto
- Tokens guardados somente no servidor, criptografados, em tabela própria com RLS (somente proprietária).
- Tabela de vínculo `appointment_id ↔ google_event_id` e registro de falhas de sincronização.
- Horários ocupados do Google bloqueiam a agenda online; se a consulta falhar, o sistema não apresentará os horários externos como verificados.
- Sincronização unidirecional (studio → Google) + leitura de ocupado. Sincronização bidirecional completa não será prometida sem implementação e testes.
