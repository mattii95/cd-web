"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "@/components/icons";
import { resolveBackHref } from "@/lib/back-href";

function BackLinkView({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="fx-ghost inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.16] px-4 py-2.5 text-sm font-medium text-text no-underline"
    >
      <ArrowLeft />
      Volver al blog
    </Link>
  );
}

function ResolvedBackLink() {
  const href = resolveBackHref(useSearchParams().get("volver"));
  return <BackLinkView href={href} />;
}

// useSearchParams exige <Suspense> con cacheComponents para que la página se prerenderice.
export function BackLink() {
  return (
    <Suspense fallback={<BackLinkView href="/blog" />}>
      <ResolvedBackLink />
    </Suspense>
  );
}
