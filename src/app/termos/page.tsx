import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/site/legal-page";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/env";
import { getPublicBusiness } from "@/lib/public-data";
import { defaultTerms } from "@/lib/legal-defaults";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Termos de Uso" };

export default async function TermsPage() {
  const b = await getPublicBusiness(DEFAULT_BUSINESS_SLUG);
  if (!b) notFound();
  return <LegalPage business={b} title="Termos de Uso" text={b.terms_of_use || defaultTerms(b.name)} isDefault={!b.terms_of_use} />;
}
