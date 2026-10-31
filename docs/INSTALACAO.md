# Instalação (ambiente local)

Requisitos: Node.js 20.9+ (recomendado 22), Docker, Git.

```bash
npm install
npx supabase start          # sobe banco, autenticação, storage e e-mail de teste (Mailpit)
npx supabase db reset       # aplica todas as migrations (cria a empresa Julia Santos Epil)
cp .env.example .env.local  # preencha com as chaves exibidas por "npx supabase status"
```

Crie a primeira administradora (veja `docs/ADMINISTRACAO.md`):

```bash
npm run admin:create -- --email seu-email@exemplo.com
```

Rode o sistema:

```bash
npm run dev     # http://localhost:3000
```

- Site público: http://localhost:3000
- Agendamento: http://localhost:3000/agendar/julia-santos-epil
- Painel: http://localhost:3000/admin/login
- E-mails de teste (recuperação de senha): http://127.0.0.1:54324

## Testes

```bash
npm test             # testes unitários
npm run test:db      # regras de agenda + isolamento entre empresas (RLS)
npm run build && npm start   # em outro terminal:
npm run test:e2e     # testes no navegador (usa ADMIN de teste, ver cabeçalho do arquivo)
```
