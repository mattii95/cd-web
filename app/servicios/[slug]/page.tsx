import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceCta } from "@/components/service/cta";
import { ServiceFeatures } from "@/components/service/features";
import { ServiceIdealFor } from "@/components/service/ideal-for";
import { OtherServices } from "@/components/service/other-services";
import { ServiceProcess } from "@/components/service/process";
import { ServiceHero } from "@/components/service/hero";
import { getService, services } from "@/lib/services";

export function generateStaticParams() {
  return services.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/servicios/[slug]">): Promise<Metadata> {
  const service = getService((await params).slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.intro,
    alternates: { canonical: `/servicios/${service.slug}` },
    openGraph: { title: service.title, description: service.intro },
  };
}

export default async function ServicePage({
  params,
}: PageProps<"/servicios/[slug]">) {
  const service = getService((await params).slug);
  if (!service) notFound();

  return (
    <main>
      <ServiceHero service={service} />
      <ServiceFeatures service={service} />
      <ServiceProcess />
      <ServiceIdealFor service={service} />
      <ServiceCta service={service} />
      <OtherServices current={service} />
    </main>
  );
}
