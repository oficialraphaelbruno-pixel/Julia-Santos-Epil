# AGENTS.md — instruções para agentes de código

Projeto: **Julia Santos Epil | Studio Manager** (Next.js 16 App Router + Supabase).
Idioma da interface: **pt-BR**. Moeda BRL, datas DD/MM/AAAA, 24h, fuso `America/Sao_Paulo`.

## Regras invioláveis
- Nunca inventar endereço, horários, serviços, preços, biografia, depoimentos ou avaliações. Tudo vem do banco (painel).
- Nunca alterar/substituir a foto da Julia nem recriar a logomarca (arquivos em `public/brand/`).
- Nunca expor `SUPABASE_SECRET_KEY` no navegador (só em arquivos com `import "server-only"`).
- O site público NÃO acessa tabelas pelo navegador: usa Server Actions + funções SQL chamadas com a chave secreta.
- Toda tabela de negócio tem `business_id` e RLS. Novas tabelas: habilitar RLS + políticas com `is_member()/is_owner()`.
- Não declarar integrações (Google, e-mail, WhatsApp API) como funcionando sem estarem implementadas e testadas.
- O atalho de 3 cliques na logo apenas abre `/admin/login`; segurança fica no login + RLS.

## Estrutura
- `supabase/migrations/` — esquema, RLS, funções de agenda (`check_slot`, `get_available_slots`, `create_online_booking`, ...).
- `supabase/tests/` — testes SQL (`npm run test:db`).
- `src/app/(público)`: `/`, `/agendar/[slug]`, `/agendamento/[token]`, `/privacidade`, `/termos`.
- `src/app/admin/(painel)` — painel protegido; `src/app/admin/actions` — Server Actions (sempre `assertAdmin()`).
- `src/lib` — utilitários (formatação, telefone, WhatsApp, ICS, auth).
- `tests/unit` (vitest) e `tests/e2e/run.mjs` (Playwright, só ambiente local).

## Comandos
```
npx supabase start && npx supabase db reset
npm run dev | npm run build | npm test | npm run test:db | npm run test:e2e
```
