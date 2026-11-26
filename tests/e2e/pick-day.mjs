/**
 * Escolhe o N-ésimo dia livre do calendário de agendamento.
 * No fim do mês sobram poucos dias: nesse caso avança para o mês seguinte.
 */
export async function pickDay(p, n) {
  const days = p.locator("[role=gridcell]:not([disabled])");
  await days.first().waitFor({ timeout: 15000 }).catch(() => {});
  if ((await days.count()) <= n) {
    await p.getByRole("button", { name: "Próximo mês" }).click();
    await p.waitForTimeout(300);
    await days.first().waitFor({ timeout: 15000 });
  }
  await days.nth(n).click();
}
