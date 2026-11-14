"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "@/components/icons";
import { getPost } from "@/lib/blog-posts";

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

// Solo acepta /blog/{slug} de un artículo que existe: evita un open redirect.
function ResolvedBackLink() {
  const volver = useSearchParams().get("volver");
  const match = volver?.match(/^\/blog\/([a-z0-9-]+)$/);
  const href = match && getPost(match[1]) ? volver! : "/blog";
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
