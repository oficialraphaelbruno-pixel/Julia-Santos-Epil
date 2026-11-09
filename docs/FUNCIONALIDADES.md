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

## ✅ Implementadas e testadas (Fase 2)
- Google Agenda via OAuth 2.0 oficial: conectar, escolher agenda, criar/atualizar/remover eventos de agendamentos confirmados, vínculo agendamento ↔ evento, horários ocupados do Google bloqueiam a agenda online, status da conexão, desconectar (revoga o token), registro de falhas. Tokens criptografados (AES-256-GCM) e acessíveis só pelo servidor. **Lógica testada com respostas simuladas; a conexão real depende das credenciais OAuth.**
- Se a consulta ao Google falhar, os horários são verificados só na agenda interna e a reserva fica **pendente** (nunca "verificada" indevidamente).
- E-mails transacionais via SMTP (recebido, confirmação, cancelamento, reagendamento, lembretes) com logomarca e cores; sem duplicidade; registro de cada envio. Testado com entrega real em servidor SMTP local.
- Lembretes automáticos (véspera; 2h antes com agendador de hora em hora), protegidos por segredo.
- Modelos de mensagem editáveis (WhatsApp manual e e-mails) com prévia.
- WhatsApp Business Cloud API (oficial) preparada: só pode ser ativada após envio de teste real.
- Verificação em duas etapas (TOTP) no login do painel.
- Histórico do agendamento (alterações, e-mails, sincronização).

## ⏳ Pendentes
- Configuração externa da Fase 2: credenciais OAuth do Google, provedor SMTP e (opcional) WhatsApp Cloud API.
- Fase 3: Financeiro completo (despesas, estornos, relatórios), pacotes, estoque, relatórios/CRM com gráficos, convite de funcionárias pelo painel.
- Fase 4: cadastro de outras empresas, painel da plataforma, planos e assinaturas.
- Publicação: depende de contas na hospedagem, Supabase de produção e domínio (ver `IMPLANTACAO.md`).

## ✅ Sinal via Pix e orientações (novembro/2026)
- Sinal configurável (padrão 50%) cobrado no agendamento online, com Pix copia e cola e QR code no padrão do Banco Central (valor, favorecida e referência do agendamento).
- A cliente precisa aceitar os Termos de Uso (com as regras do sinal) para concluir; o aceite fica registrado.
- O horário fica **pendente** até a Julia marcar "Sinal recebido" (lança o pagamento no financeiro e confirma o agendamento). Também é possível dispensar o sinal ou registrar a devolução (estorno).
- Painel de Controle lista os sinais aguardando Pix; agenda mostra "Sinal pendente".
- Orientações pré e pós-procedimento por serviço: as pré acompanham a confirmação; as pós são enviadas ao concluir o atendimento (e-mail + botão de WhatsApp).
- Configuração em Agendamento Online → "Cobrar sinal via Pix" (chave, favorecida, banco, porcentagem e prazo).
- **Não há verificação automática do Pix**: o recebimento é confirmado manualmente pela Julia (Pix estático não notifica o sistema).

## ✅ Cupons, financeiro e ordem dos serviços (novembro/2026)
- **Cupons de desconto**: nome personalizado, % ou valor fixo, limite de usos, 1 uso por cliente, valor mínimo, validade, serviços específicos, ativar/desativar. A cliente aplica no agendamento online (o sinal é recalculado sobre o valor com desconto). Cancelar um agendamento devolve o uso.
- **Financeiro**: despesas (com categoria, vencimento, fornecedor, forma de pagamento, comprovante em área privada e repetição mensal para despesas fixas), receitas avulsas, resumo do mês (recebido, despesas, resultado, a receber, previsto, ticket médio, descontos), gráfico de 6 meses, receita por serviço e por forma de pagamento, despesas por categoria, alerta de despesas vencidas e exportação CSV.
- **Ordem dos serviços e categorias**: setas no painel; o site segue a mesma ordem.
- **Domínio**: guia em `docs/DOMINIO.md`.

## ✅ Consulta de agendamento pela cliente
- `/agendar/julia-santos-epil/consultar` (link no topo da página de agendamento e no rodapé do site).
- A cliente informa **e-mail ou WhatsApp + nome completo** (como no agendamento; acentos e maiúsculas não importam) e vê seus agendamentos futuros: serviço, data, horário, valor, cupom, situação, Pix do sinal pendente e botões "Adicionar ao Google Agenda" / arquivo .ics.
- Segurança: mensagem genérica quando não encontra (não revela se a cliente existe) e limite de 8 consultas a cada 15 minutos por aparelho. Remarcar/cancelar continua pelo link seguro da confirmação ou pelo WhatsApp.
- Guia de ativação do Google Agenda exibido na própria tela Integrações.
