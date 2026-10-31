import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/site/legal-page";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/env";
import { getPublicBusiness } from "@/lib/public-data";
import { defaultPrivacyPolicy } from "@/lib/legal-defaults";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de Privacidade" };

export default async function PrivacyPage() {
  const b = await getPublicBusiness(DEFAULT_BUSINESS_SLUG);
  if (!b) notFound();
  return <LegalPage business={b} title="Política de Privacidade" text={b.privacy_policy || defaultPrivacyPolicy(b.name)} isDefault={!b.privacy_policy} />;
}
