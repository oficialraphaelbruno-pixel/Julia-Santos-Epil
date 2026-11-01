---
name: revisao-codigo
description: Revisão de código específica da plataforma Julia Santos Epil — segurança (RLS, permissões no servidor, segredos), preservação do sistema existente, LGPD e qualidade. Use antes de abrir PR ou de pedir aprovação de deploy.
---

# Revisão de código

Revise o diff da branch contra `main` e verifique cada item:

**Segurança**
- [ ] Toda Server Action/rota nova chama `assertAdmin()`/`assertPermission()` no início.
- [ ] Tabelas novas têm `business_id`, RLS habilitada e políticas; `anon` sem privilégios.
- [ ] Funções `SECURITY DEFINER` têm `set search_path = ''` e validam `is_member`/`has_permission`.
- [ ] Nenhum segredo no código, em `NEXT_PUBLIC_*` ou em logs.
- [ ] Webhooks validam assinatura e são idempotentes.
- [ ] Nenhuma execução de comando de sistema a partir de entrada do usuário.

**Preservação**
- [ ] Migrações apenas aditivas; nada removido/renomeado.
- [ ] Rotas públicas (`/`, `/agendar`, `/agendamento`) e agenda continuam funcionando.

**Dados e LGPD**
- [ ] Sem métricas fictícias; estados vazios corretos.
- [ ] Papel `agency` não acessa observações de clientes.
- [ ] Exportações sem dados pessoais desnecessários.

**Qualidade**
- [ ] `npm run typecheck`, `npm run lint`, `npm test` passam (resultado real colado).
- [ ] Interface responsiva (375px) e acessível (foco, contraste, rótulos).
- [ ] Textos em pt-BR, valores em BRL, datas DD/MM/AAAA.

Reporte achados por gravidade com arquivo:linha e correção sugerida.
