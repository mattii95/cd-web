import { getPost } from "@/lib/blog-posts";

// Solo acepta /blog/{slug} de un artículo que existe: evita un open redirect.
export function resolveBackHref(volver: string | null): string {
  const match = volver?.match(/^\/blog\/([a-z0-9-]+)$/);
  return match && getPost(match[1]) ? volver! : "/blog";
}

// Después del login: artículo existente, perfil o admin. Cualquier otro valor va al perfil.
export function resolveAfterLogin(volver: string | null): string {
  if (volver === "/cuenta/perfil" || volver === "/admin") return volver;
  const match = volver?.match(/^\/blog\/([a-z0-9-]+)$/);
  return match && getPost(match[1]) ? volver! : "/cuenta/perfil";
}
