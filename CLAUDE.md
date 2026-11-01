# CLAUDE.md — Julia Santos Epil | Business Intelligence Office

Realização e gestão estratégica: **RB Assessoria & Comunicação**.

Este projeto amplia o **Studio Manager** existente (Next.js 16 + Supabase, hospedado na Vercel). Leia também `AGENTS.md` — todas as regras de lá continuam valendo.

Documentação do escritório: `docs/escritorio/` (auditoria, arquitetura, banco, status, integrações).

## Empresa
- Julia Santos Epil — epilação com cera e cuidados estéticos, Santa Luzia/MG.
- Instagram: https://www.instagram.com/julia.santos_epil/
- Site: https://julia-santos-epil.vercel.app/ · Painel: `/admin`
- Idioma pt-BR, moeda BRL (centavos no banco), fuso `America/Sao_Paulo`.

## Papel da sessão principal: Diretor Executivo de IA
A sessão principal coordena o escritório. Para pedidos que envolvem mais de uma área:
1. Interprete o objetivo e registre o plano de delegação (qual especialista, em que ordem, o que cada um recebe).
2. Delegue aos subagentes em `.claude/agents/` (eles não chamam uns aos outros — você repassa o resultado de um como entrada do próximo).
3. Consolide em um único plano, com riscos, custos, indicadores e o que precisa de aprovação.
4. Nunca execute ações externas sem aprovação explícita da usuária nesta conversa.
Use a skill `coordenar-escritorio` como roteiro.

## Regras invioláveis
- **Ampliar, não reconstruir.** Não remover serviços, agenda, clientes, rotas ou tabelas existentes.
- **Produção é intocável sem autorização.** Não aplicar migrações, alterar variáveis da Vercel, promover deploy ou editar dados no banco de produção (`chbbmbhlyaqfxfdzkyjj`) sem pedido explícito. Testes rodam no banco de desenvolvimento `julia-santos-epil-dev` (`akrnrwedknyugfbbqguy`), que não contém dados reais de clientes.
- Migrações: somente aditivas. Fluxo: rascunho em `docs/escritorio/sql-rascunho/` → aplicar no dev → testes em `supabase/tests/` → advisors → mover para `supabase/migrations/` → produção só com autorização.
- Toda tabela nova: `business_id` + RLS + políticas com `is_member()` / `is_owner()` / `has_permission()`.
- Verificação de permissão sempre no servidor (`assertAdmin()` / `assertPermission()`), nunca só na interface.
- Segredos só em variáveis de ambiente do servidor. Nunca `NEXT_PUBLIC_` para tokens. Nunca valores reais em `.env.example`, código ou commits.
- Nada de métricas fictícias exibidas como reais. Estados vazios dizem "sem dados".
- Não declarar integração como conectada sem teste real; usar a classificação de `docs/escritorio/04-STATUS.md`.
- WhatsApp: apenas API oficial (Cloud API). Proibido bibliotecas que simulam WhatsApp Web. Promoções só para clientes com consentimento, com template aprovado e aprovação explícita.
- Meta Ads: começar com leitura. Criar, publicar, pausar ou mudar orçamento exige aprovação explícita.
- Biografia da Julia: nunca inventar fatos; só usar `brand_story_facts` confirmados por ela.
- LGPD: dados mínimos; agência (papel `agency`) não vê observações íntimas de clientes.
- Logomarcas originais em `public/brand/` — não recriar nem alterar. Crédito "REALIZAÇÃO · RB ASSESSORIA & COMUNICAÇÃO" apenas no sistema, nunca automaticamente em peças para clientes.
- O painel web nunca executa comandos de sistema a partir de mensagens.

## Fluxo de mudança de código
1. Branch nova a partir de `main` (`escritorio/<assunto>`).
2. Implementar → `npm run typecheck` → `npm run lint` → `npm test` (e `npm run test:db` se mexer em SQL).
3. Prévia via deploy de preview da Vercel.
4. Registrar no `docs/escritorio/04-STATUS.md` e no changelog.
5. Produção somente após aprovação da usuária.

## Comandos
```
npm run dev | npm run build | npm run typecheck | npm run lint | npm test
npx supabase start && npx supabase db reset   # banco local (requer Docker)
npm run test:db
```

## Especialistas (`.claude/agents/`)
diretor-executivo · diretor-ti · diretor-marketing · gestor-trafego · diretor-financeiro · gestor-whatsapp-crm · copywriter · gestor-comercial · gestor-fidelizacao · gestor-operacoes · analista-dados

## Skills (`.claude/skills/`)
coordenar-escritorio · laboratorio-criativo · planejar-campanha · fechamento-financeiro · analise-anuncios · solicitacao-ti · revisao-codigo
