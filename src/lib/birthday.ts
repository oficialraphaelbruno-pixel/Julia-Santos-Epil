/** Aniversários: datas no formato AAAA-MM-DD (a data de hoje vem no fuso do studio). */

/** Dias até o próximo aniversário (0 = hoje). 29/02 é tratado como 28/02 em anos não bissextos. */
export function daysUntilBirthday(birthday: string, todayKey: string): number {
  const [, bm, bd] = birthday.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  const next = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const day = bm === 2 && bd === 29 && !leap ? 28 : bd;
    return Date.UTC(year, bm - 1, day);
  };
  let target = next(ty);
  if (target < today) target = next(ty + 1);
  return Math.round((target - today) / 864e5);
}

/** Idade completa na data de hoje. */
export function ageOn(birthday: string, todayKey: string): number | null {
  const [by, bm, bd] = birthday.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  if (!by || by < 1900) return null;
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** Mesmo mês do aniversário. */
export function birthdayInMonth(birthday: string, todayKey: string): boolean {
  return birthday.slice(5, 7) === todayKey.slice(5, 7);
}
