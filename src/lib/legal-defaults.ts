/**
 * Textos-base exibidos enquanto a empresa não cadastra suas próprias versões.
 * São modelos genéricos e devem ser revisados pela empresa (idealmente com apoio jurídico).
 */
export function defaultPrivacyPolicy(name: string) {
  return `Esta política explica como ${name} trata os dados pessoais de quem agenda atendimentos por este site, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

1. Dados coletados
Nome completo, número de WhatsApp e, opcionalmente, e-mail e observações que você mesma informar ao agendar.

2. Finalidade
Os dados são usados para registrar, confirmar, lembrar, reagendar ou cancelar seus atendimentos e para entrar em contato sobre eles. Mensagens de novidades e relacionamento só são enviadas se você autorizar, e essa autorização pode ser revogada a qualquer momento.

3. Compartilhamento
Os dados não são vendidos. Eles são armazenados em provedores de tecnologia contratados para operar o sistema de agendamento (hospedagem e banco de dados), sob obrigações de segurança e confidencialidade.

4. Segurança
Os dados são protegidos por controle de acesso, conexão criptografada (HTTPS) e regras de isolamento no banco de dados. Apenas pessoas autorizadas do studio podem acessá-los.

5. Seus direitos
Você pode solicitar a confirmação do tratamento, acesso, correção, portabilidade ou exclusão dos seus dados, bem como revogar consentimentos, entrando em contato pelos canais oficiais informados neste site.

6. Retenção
Os dados são mantidos enquanto houver relacionamento ou pelo prazo necessário ao cumprimento de obrigações legais.

7. Atualizações
Esta política pode ser atualizada. A versão vigente estará sempre disponível nesta página.`;
}

export function defaultTerms(name: string) {
  return `Ao utilizar este site e o agendamento online de ${name}, você concorda com os termos abaixo.

1. Agendamento
O horário escolhido fica reservado após a conclusão do agendamento. Quando a confirmação não for automática, o studio confirmará o atendimento pelos canais de contato informados.

2. Informações corretas
Você se compromete a informar dados verdadeiros e um número de WhatsApp válido para contato.

3. Cancelamento e reagendamento
Cancelamentos e reagendamentos online seguem os prazos e regras exibidos no momento do agendamento e na página do seu agendamento. Fora desses prazos, entre em contato diretamente com o studio.

4. Link de gerenciamento
O link individual do seu agendamento é pessoal. Não o compartilhe com terceiros.

5. Valores
Os valores exibidos são os vigentes no momento do agendamento e podem ser atualizados pelo studio para novos agendamentos.

6. Contato
Dúvidas podem ser enviadas pelos canais oficiais informados neste site.`;
}
