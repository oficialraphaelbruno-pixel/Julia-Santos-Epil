# Campanhas de e-mail (Resend)

Campanhas como Natal, Mês das Mulheres ou inauguração são enviadas pelo **Resend** (resend.com), o mesmo serviço dos e-mails automáticos.

## Quem recebe
Só clientes que marcaram **"Aceito receber novidades"** no agendamento (ou que a Julia marcou no cadastro da cliente, com autorização dela) **e** informaram e-mail. A lista fica no Resend no segmento **"Novidades — clientes que autorizaram"**.
Toda campanha tem o link "Não quero mais receber". Quem clica sai da lista e não volta.

## Usando o copywriter no Claude Code
O projeto tem um agente pronto em `.claude/agents/copywriter-email.md`.

1. Abra o projeto no Claude Code e confira com `/mcp` que os conectores **Resend** e **Supabase** estão ativos.
2. Peça, por exemplo:
   > Use o copywriter-email para criar a campanha de Natal com o cupom NATAL30. Imagem: [anexe a imagem ou peça para ele sugerir].
3. Ele confere o cupom, atualiza a lista, escreve o texto, monta o e-mail como **rascunho** no Resend, envia um **teste** para você e mostra a prévia.
4. Leia a prévia e o e-mail de teste. Peça ajustes ou responda **APROVO O ENVIO**.

## Enviando pelo painel do Resend (opção manual)
1. Entre em resend.com → **Broadcasts**.
2. Abra o rascunho da campanha (ex.: "2026-12 Natal").
3. Confira o **remetente** (`agendamentos@juliasantosepil.com.br`), o **segmento** ("Novidades — clientes que autorizaram"), o assunto e o texto. Ajuste no editor se quiser.
4. Use **Send test** para mandar um teste para você.
5. Clique em **Send** → **Send now** (agora) ou **Schedule** (escolha data e hora).
6. Depois de 1–2 dias, veja em **Broadcasts → (campanha)** quantas abriram e clicaram. No painel do site, em **Cupons**, veja quantas usaram o cupom.

## Cuidados
- Antes de criar a campanha, crie (ou confira) o **cupom** em `/admin/cupons`. O link do cupom fica em `https://juliasantosepil.com.br/cupom/CODIGO`.
- E-mails digitados errado (ex.: terminando em `.comc`) não recebem: corrija no painel em **Clientes**.
- Limites e preço do plano: veja em resend.com → **Settings → Billing**. O copywriter avisa se a campanha passar do limite.
- Imagens de campanha ficam em `public/email/campanhas/` (largura 1200 px, até ~300 KB).
