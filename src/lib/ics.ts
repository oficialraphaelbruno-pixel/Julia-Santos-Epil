function toIcsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export interface CalendarEventInput {
  uid: string;
  title: string;
  description: string;
  location?: string | null;
  startsAt: string;
  endsAt: string;
}

/** Arquivo .ics (iCalendar) compatível com Apple, Google e Outlook. */
export function buildIcs(e: CalendarEventInput) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studio Manager//Agendamentos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(e.startsAt)}`,
    `DTEND:${toIcsDate(e.endsAt)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(e.description)}`,
    e.location ? `LOCATION:${escapeIcs(e.location)}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

/** Link "Adicionar ao Google Agenda" (modelo público, não exige integração). */
export function googleCalendarTemplateLink(e: CalendarEventInput) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toIcsDate(e.startsAt)}/${toIcsDate(e.endsAt)}`,
    details: e.description,
  });
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
