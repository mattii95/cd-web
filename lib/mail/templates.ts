export type Email = { subject: string; html: string; text: string };

const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function build(
  subject: string,
  name: string,
  intro: string,
  action: string,
  url: string,
  outro: string,
): Email {
  const text = `Hola ${name},\n\n${intro}\n\n${action}: ${url}\n\n${outro}\n\nCourroux Digital`;
  const html = `<p>Hola ${escape(name)},</p><p>${escape(intro)}</p><p><a href="${escape(url)}">${escape(action)}</a></p><p>${escape(outro)}</p><p>Courroux Digital</p>`;
  return { subject, html, text };
}

export function verificationEmail(name: string, url: string): Email {
  return build(
    "Verificá tu email",
    name,
    "Para activar tu cuenta, verificá tu email con este link. Vence en 24 horas.",
    "Verificar email",
    url,
    "Si no creaste una cuenta, ignorá este mensaje.",
  );
}

export function resetPasswordEmail(name: string, url: string): Email {
  return build(
    "Recuperá tu contraseña",
    name,
    "Para elegir una contraseña nueva, usá este link. Vence en 1 hora.",
    "Elegir contraseña nueva",
    url,
    "Si no pediste este cambio, ignorá este mensaje: tu contraseña no cambia.",
  );
}
