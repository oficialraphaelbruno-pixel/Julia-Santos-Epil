# Julia Santos Epil | Studio Manager

Sistema web de gestão e agendamento online para o studio **Julia Santos Epil** — preparado para virar SaaS multiempresa.

- **Site público** premium com agendamento online em 6 etapas (sem senha para a cliente).
- **Painel administrativo** protegido: Painel de Controle, Agenda (dia/semana/mês/lista), Clientes, Serviços, Horários, Agendamento Online e Configurações.
- **Um único banco** (Supabase PostgreSQL) compartilhado: o que a cliente agenda aparece na hora no painel.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · componentes no estilo shadcn/ui (Radix) · Lucide · Supabase (PostgreSQL, Auth, Storage, RLS) · Zod · React Hook Form · date-fns (pt-BR, `America/Sao_Paulo`).

## Segurança (resumo)
- Login real (Supabase Auth), sem cadastro público; primeira administradora criada por script (`npm run admin:create`).
- Autorização verificada no servidor em toda página/ação + **Row Level Security** no banco (isolamento por empresa).
- Site público sem acesso direto às tabelas: Server Actions + funções SQL chamadas com chave secreta (somente servidor).
- Conflitos de horário impedidos por restrição `EXCLUDE` do PostgreSQL + bloqueio transacional.
- Token de gerenciamento do agendamento com 256 bits (somente o hash é armazenado).
- Limitação de abuso (agendamentos, login, recuperação), honeypot, cabeçalhos de segurança, painel com `noindex`.
- Auditoria de alterações críticas.
- Os 3 cliques na logomarca **apenas abrem** `/admin/login`; não substituem a autenticação.

## Documentação
- [Instalação](docs/INSTALACAO.md)
- [Implantação e domínio](docs/IMPLANTACAO.md)
- [Administração e primeiro acesso](docs/ADMINISTRACAO.md)
- [Google Agenda (Fase 2)](docs/GOOGLE-AGENDA.md)
- [Funcionalidades implementadas e pendentes](docs/FUNCIONALIDADES.md)
- [Resultados de testes](docs/TESTES.md)
- [Instruções para agentes](AGENTS.md)

## Início rápido
```bash
npm install
npx supabase start && npx supabase db reset
cp .env.example .env.local   # preencha com "npx supabase status"
npm run admin:create -- --email seu-email@exemplo.com
npm run dev
```

## Custos recorrentes previstos
| Serviço | Quando | Custo |
|---|---|---|
| Hospedagem comercial (ex.: Vercel Pro) | publicação | ~US$ 20/mês |
| Supabase | Free para começar; Pro recomendado (backups) | US$ 0–25/mês |
| Domínio .com.br | publicação | ~R$ 40/ano |
| WhatsApp | modo manual (wa.me) | grátis |

Nenhum serviço pago foi contratado.
