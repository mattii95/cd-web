// Solo valida el formato /blog/{slug}: BackLink es un componente cliente y no puede consultar la base.
// Un slug inexistente termina en la página de no encontrado, inofensiva. Evita un open redirect.
const ARTICLE = /^\/blog\/[a-z0-9-]+$/;

export function resolveBackHref(volver: string | null): string {
  return volver && ARTICLE.test(volver) ? volver : "/blog";
}

// Después del login: artículo, perfil o admin. Cualquier otro valor va al perfil.
export function resolveAfterLogin(volver: string | null): string {
  if (volver === "/cuenta/perfil" || volver === "/admin") return volver;
  return volver && ARTICLE.test(volver) ? volver : "/cuenta/perfil";
}
