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

## ✅ Link de cupom e modo escuro do painel
- **Link do cupom**: cada cupom tem um link curto `https://juliasantosepil.com.br/cupom/CODIGO` (botões "Copiar link" e "Enviar no WhatsApp" na tela Cupons). O link abre o agendamento com o cupom ativado; se o cupom vale para **um único serviço**, o serviço já vem escolhido. O desconto é validado e aplicado na revisão (as mesmas regras do cupom digitado). Parâmetros de campanha (ex.: `?utm_source=instagram`) são mantidos. Cupom inexistente, vencido ou esgotado mostra um aviso e a cliente agenda normalmente.
- **Modo escuro (somente o painel)**: botão "Modo escuro / Modo claro" no menu lateral (computador) e no topo (celular). A escolha fica salva no aparelho; o site público continua sempre claro.

## ✅ Apagar dados da cliente (LGPD)
- Na ficha da cliente (Clientes → nome da cliente) → **Apagar dados da cliente** (só proprietárias). Confirmação digitando APAGAR.
- Sem atendimentos: o cadastro é excluído por completo. Com atendimentos: nome, WhatsApp, e-mail, aniversário, observações, autorização de novidades, mensagens dos agendamentos e destinatário dos envios são apagados; atendimentos e valores ficam (como "Cliente anonimizada") para o controle financeiro. Eventos futuros no Google Agenda são atualizados.
- Modo escuro: botão (lua/sol) também no topo do menu lateral, ao lado da logo; o menu rola em telas baixas.

## ✅ Aceites, textos legais e orientação do sinal (12/11/2026)
- Revisão do agendamento: duas caixas obrigatórias — Termos de Uso + política de agendamento e cancelamento, e Política de Privacidade (o servidor também exige as duas).
- Textos revisados (cópias em `docs/textos-legais/`, versão anterior em `docs/textos-legais/versao-anterior/`): Política de Privacidade (dados, e-mail, finalidades, bases legais, fornecedores, retenção, direitos), Termos de Uso (sinal, cancelamento, arrependimento, cupons) e política de cancelamento exibida no agendamento. Editáveis no painel.
- "Adicionar ao Google Agenda" e arquivo .ics com o local preenchido (nome + endereço do studio) na confirmação, na página do agendamento e na consulta.
- Cartão do sinal com passo a passo: Pix Copia e Cola, QR Code ou chave (com botão de copiar), conferência da favorecida e envio do comprovante.

## ✅ Foto, bloqueio, ofertas e aniversários (16/11/2026)
- **Foto da cliente**: na ficha (Clientes → cliente → Adicionar foto). Arquivo em área privada do Supabase (bucket `client-photos`), exibido só por link temporário; miniatura na lista. Removida ao apagar os dados da cliente. Política de Privacidade atualizada.
- **Bloquear cliente**: ficha → Bloquear (motivo interno opcional). A cliente bloqueada não agenda pelo site — nem com outro número, se usar o mesmo e-mail — e vê só "fale com o studio pelo WhatsApp". Etiqueta "Bloqueada" na lista, filtro "Bloqueadas", aviso no agendamento e na busca de clientes. Desbloquear a qualquer momento.
- **Ofertas (order bump)**: Serviços → "Ofertas no agendamento". Ex.: quem agenda Nariz vê "adicione Buço por R$ 15 (de R$ 25)". O extra é feito no mesmo horário: os horários livres já consideram a duração total; valor, sinal e duração somam; o agendamento fica como "Nariz + Buço". Remarcação e edição pelo painel mantêm a duração completa.
- **Aniversários**: card "Aniversariantes da semana" no Painel de Controle com botão "Parabéns pelo WhatsApp"; filtro "Aniversariantes do mês" e etiqueta 🎂 na lista; idade e contagem regressiva na ficha. A data é preenchida em Editar cliente.

## ✅ Administrador geral e permissões (17/11/2026)
- O login do Raphael é o **administrador geral** (`profiles.is_platform_admin`): acesso total e a tela **Usuários e permissões** (só ele vê).
- Nessa tela: criar novos logins, alterar a senha de qualquer usuário do painel e liberar/bloquear, por pessoa, 11 áreas: site, serviços e preços, ofertas, cupons, horários de funcionamento, regras do agendamento online, textos legais, integrações, comunicação, financeiro e exportação.
- O bloqueio vale no banco de dados (não só na tela). Área bloqueada mostra aviso "Edição bloqueada pelo administrador do painel"; Financeiro some do menu.
- Sempre liberado: agenda, clientes, confirmação de sinal, bloqueio de horário, pedidos LGPD das clientes e a própria senha.
- Só o administrador geral altera a lista de usuários (antes qualquer proprietária podia).

## Programa de indicação (Painel → Indicações)

- Desativado por padrão. A Julia ativa e define: desconto de quem indica (% ou R$), desconto opcional da amiga indicada (só no 1º agendamento) e validade em dias.
- Cada cliente tem um link pessoal `/indicacao/CODIGO` (ex.: `ANA7K2P`). Ele aparece na tela de confirmação do agendamento (copiar / WhatsApp) e na ficha da cliente no painel ("Enviar para a cliente").
- A amiga precisa ser cliente nova (WhatsApp e e-mail ainda não cadastrados); ninguém indica a si mesma; cliente bloqueada ou com dados apagados não indica.
- O histórico guarda quem indicou quem (ficha da cliente: "Indicada por" e "Indicou N amigas"; página Indicações: lista completa com situação e desconto).
- Quando o atendimento da amiga é marcado como **Concluído**, quem indicou ganha o desconto e recebe um e-mail avisando.
- O desconto entra sozinho no próximo agendamento online de quem indicou (precisa ser o mesmo WhatsApp **e** e-mail do cadastro). Se esse agendamento for cancelado ou marcado como falta, o desconto volta. A Julia pode cancelar/reativar um desconto na página Indicações.
- Não acumula com cupom. O valor do agendamento já vem com o desconto e o detalhe mostra "Desconto por indicação".
- Banco: tabelas `referral_programs`, `referrals`, `referral_rewards`; função `create_online_booking_v4`. Área de permissão: "indicacoes".
- Teste: `npm run test:e2e:indicacoes`.

## Dúvidas frequentes (FAQ), assistente Mel e lista de e-mails

- **Página /duvidas** (link no menu, no rodapé e na seção "Como funciona"): perguntas escritas pela Julia + respostas automáticas montadas com o que já está cadastrado (cuidados antes/depois de cada serviço, sinal, como agendar, cancelamento/remarcação, endereço). A chave Pix não aparece na página pública. Tem botões de Agendar, WhatsApp, "Siga @... no Instagram" e a caixa "Fique por dentro".
- **"Fique por dentro das promoções"**: na página inicial, na página Dúvidas e dentro do chat da Mel. Grava e-mail, origem e data do aceite (`newsletter_subscribers`, função `subscribe_newsletter`, só pelo servidor). Corrige e-mails digitados errado (gmial → gmail).
- **Painel → FAQ e assistente Mel**: liga/desliga, nome, boas-vindas, jeito de falar, informações extras, assuntos a evitar, limite diário (e modelo, só administrador geral); CRUD do FAQ com ordem e publicar/esconder; lista de perguntas que a Mel não soube responder (30 dias) com "Responder no FAQ"; uso do dia/30 dias. Área de permissão: "assistente".
- **Conversa da Mel**: pergunta o nome primeiro e chama a cliente pelo nome; menu com "Qual procedimento vou fazer?" (lista de serviços → cuidados cadastrados daquele serviço), "Já tenho agendamento" (botão para a consulta do agendamento), "Pagamento e sinal", "Quero agendar", "Programa de indicação" e "Quero receber promoções". Depois de cada resposta: "Tenho outra dúvida" / "Era só isso, obrigada"; ao encerrar, convida para promoções e cupons.
- **Indicação pela Mel**: a cliente informa WhatsApp + e-mail do cadastro (os dois precisam conferir) e recebe o link pessoal `/indicacao/CODIGO` com botões copiar e enviar no WhatsApp. A indicação fica registrada no painel quando a amiga agenda pelo link; o desconto de quem indicou é liberado quando a amiga é atendida e entra sozinho no próximo agendamento.
- **Mel (assistente virtual)**: balão com avatar no canto (página inicial e Dúvidas), botões rápidos, respostas curtas e acolhedoras, botões de ação (agendar, WhatsApp, Instagram, receber novidades). Só responde com os dados do painel, encaminha saúde para a Julia. Aparece só com `OPENAI_API_KEY` na Vercel + ligada no painel. Guia: `docs/ASSISTENTE-MEL.md`.
- **Painel → E-mails (novidades)**: junta quem aceitou novidades no agendamento com as inscrições do site/Mel (um e-mail por linha, com as origens). Filtros: origem, situação (atendida / agendou / nunca agendou), serviço já feito, sumidas há 90+ dias, mês de aniversário, busca. "Baixar lista (CSV para o Resend)" (exige a área Exportar), "Copiar e-mails" e remover da lista.
- Teste: `npm run test:e2e:faq-mel`.
- **Crédito da OpenAI** (painel → FAQ e assistente Mel): saldo estimado = saldo informado na recarga − gasto (estimado pelos tokens de cada mensagem, ou real pela API de custos com `OPENAI_ADMIN_KEY`). Alertas "Hora de abastecer" e "Crédito esgotado", botão Abastecer. Consumo diário em `assistant_usage_daily`.
