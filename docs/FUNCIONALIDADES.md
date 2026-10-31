# Funcionalidades

## ✅ Implementadas e testadas (Fase 1)
- Site público premium (início, sobre, serviços do banco, como funciona, contato, rodapé, privacidade, termos).
- Logomarca oficial (versão com fundo transparente gerada do original, sem redesenho) e fotografia da Julia.
- Atalho discreto: 3 cliques na logo → `/admin/login`.
- Autenticação real (Supabase Auth), sessão, recuperação de senha, sem cadastro público, rotas protegidas no servidor, painel não indexado.
- Banco multiempresa com RLS, auditoria, limitação de abuso nas rotas públicas.
- Serviços: cadastro, edição, categorias, combos, ativar/desativar/arquivar, imagem opcional.
- Horários: expediente por dia, almoço, bloqueios (horário/dia/período), férias, feriados, horários especiais.
- Agenda: dia, semana, mês, próximos; filtros; agendamento manual com sugestão de horários livres; encaixe; status (pendente, confirmado, em atendimento, concluído, cancelado, não compareceu); reagendamento.
- Proteção contra conflito: restrição `EXCLUDE` no PostgreSQL + bloqueio transacional (inclui preparação e intervalo após).
- Portal de agendamento em 6 etapas, sem senha, com consentimentos, número de referência e link seguro para cancelar/reagendar conforme regras.
- Adicionar ao calendário da cliente (Google e .ics).
- Clientes: cadastro, busca, histórico, total gasto, última visita, próximo agendamento, recorrentes, inativas, anti-duplicidade por WhatsApp, anonimização (LGPD).
- WhatsApp (modo manual wa.me): mensagem, confirmação, lembrete, cancelamento, reagendamento.
- Painel de Controle com indicadores reais; registro manual de pagamentos.
- Agendamento Online: link, copiar, compartilhar, ativar/desativar, regras, textos, capa e logo.
- Configurações: dados, endereço, conteúdo do site, imagens, textos legais, senha, equipe (visualização), exportação CSV, status das integrações.
- PWA básico (manifesto e ícones; sem promessa de funcionamento offline).

## ⏳ Pendentes
- Fase 2: Google Agenda (OAuth), e-mails transacionais, WhatsApp Business API (lembretes automáticos), modelos de mensagem editáveis, 2FA no painel.
- Fase 3: Financeiro completo (despesas, estornos, relatórios), pacotes, estoque, relatórios/CRM com gráficos, convite de funcionárias pelo painel.
- Fase 4: cadastro de outras empresas, painel da plataforma, planos e assinaturas.
- Publicação: depende de contas na hospedagem, Supabase de produção e domínio (ver `IMPLANTACAO.md`).
