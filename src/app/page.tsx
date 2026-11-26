import { notFound } from "next/navigation";
import { BusinessSite } from "@/components/site/business-site";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/env";
import { getPublicBookingData, getPublicBusiness } from "@/lib/public-data";
import { getPublicAssistant } from "@/lib/faq-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const business = await getPublicBusiness(DEFAULT_BUSINESS_SLUG);
  if (!business) notFound();
  const [{ services, categories, settings }, assistant] = await Promise.all([getPublicBookingData(business.id), getPublicAssistant(business.id)]);
  return (
    <BusinessSite business={business} services={services} categories={categories} onlineEnabled={settings?.online_enabled ?? false} assistant={assistant} />
  );
}
