/** Endereço completo do studio em uma linha (usado em e-mails, agenda e site). */
export interface AddressFields {
  address_line: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
}

export function businessAddress(b: AddressFields) {
  const cityState = [b.address_city, b.address_state].filter(Boolean).join(" - ");
  const parts = [b.address_line, b.address_district, cityState, b.address_zip ? `CEP ${b.address_zip}` : null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Local do evento de agenda: nome do studio + endereço (o Google Maps reconhece o endereço). */
export function eventLocation(name: string, b: AddressFields) {
  const addr = businessAddress(b);
  return addr ? `${name}, ${addr}` : null;
}
