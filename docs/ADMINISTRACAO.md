# Guia de administração

## Primeiro acesso (procedimento seguro)
Não existe cadastro público. A primeira conta é criada por quem tem acesso ao servidor:

```bash
npm run admin:create -- --email EMAIL_DA_JULIA
```
- Gera uma senha forte temporária exibida **uma única vez** (ou use `ADMIN_PASSWORD=...`).
- Vincula a conta à empresa como **proprietária**.
- No primeiro acesso, troque a senha em **Configurações > Segurança**.

Para funcionárias: `npm run admin:create -- --email EMAIL --role staff`.

## Acesso ao painel
- Endereço direto: `/admin/login` (pode salvar nos favoritos).
- Atalho discreto: três cliques rápidos na logomarca do site.
- Esqueceu a senha: "Esqueci minha senha" na tela de login.

## Rotina
1. **Serviços**: cadastre nome, valor, duração, preparação e intervalo após.
2. **Horários**: abra os dias, defina expediente e almoço; use bloqueios para férias, feriados e compromissos.
3. **Agendamento Online**: copie o link e coloque na bio do Instagram; defina antecedência, prazos e confirmação automática ou manual.
4. **Agenda**: confirme, inicie, conclua, registre faltas, cancele ou reagende; registre pagamentos.
5. **WhatsApp**: botões abrem a conversa com a mensagem pronta — o envio é feito por você.

## Permissões
| Ação | Proprietária | Funcionária |
|---|---|---|
| Agenda, clientes, bloqueios, pagamentos | ✔ | ✔ |
| Serviços, horários, configurações, imagens | ✔ | — |
| Excluir/anonimizar clientes, excluir pagamentos | ✔ | — |

## LGPD
- A cliente aceita a Política de Privacidade ao agendar; o consentimento para mensagens de relacionamento é separado e opcional.
- Pedido de exclusão: abra a cliente → **Anonimizar dados** (mantém estatísticas, remove dados pessoais).
- Exportação: Configurações > Exportação de dados (CSV).
- Auditoria: alterações de agendamentos, serviços, equipe, pagamentos e regras ficam em `audit_logs`.
