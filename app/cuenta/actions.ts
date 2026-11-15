"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { resolveAfterLogin } from "@/lib/back-href";
import { getAuth } from "@/lib/auth/auth";

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const error = (message: string): FormState => ({ status: "error", message });

const MSG = {
  credenciales: "El email o la contraseña no son correctos.",
  sinVerificar: "Tenés que verificar tu email. Te mandamos un link nuevo.",
  datos: "Revisá los datos e intentá de nuevo.",
  limite: "Demasiados intentos. Probá de nuevo en un minuto.",
  token: "El link venció o no es válido. Pedí uno nuevo.",
  inesperado: "No pudimos completar la operación. Intentá de nuevo en unos minutos.",
  enviado: "Si el email tiene una cuenta, te enviamos un link.",
};

const email = z.email();
const password = z.string().min(8).max(128);

// Traduce los errores de Better Auth a los mensajes del spec.
function toState(e: unknown): FormState {
  if (isAPIError(e)) {
    if (e.statusCode === 429) return error(MSG.limite);
    const code = (e.body as { code?: string } | undefined)?.code;
    if (code === "INVALID_EMAIL_OR_PASSWORD") return error(MSG.credenciales);
    if (code === "EMAIL_NOT_VERIFIED") return error(MSG.sinVerificar);
    if (code === "INVALID_TOKEN") return error(MSG.token);
    if (e.statusCode === 400 || e.statusCode === 422) return error(MSG.datos);
  }
  return error(MSG.inesperado);
}

const field = (data: FormData, name: string) => {
  const v = data.get(name);
  return typeof v === "string" ? v : "";
};

const VERIFICADO = "/cuenta/verificar?estado=ok";

export async function signInAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1) })
    .safeParse({ email: field(data, "email"), password: field(data, "password") });
  if (!parsed.success) return error(MSG.datos);

  try {
    await getAuth().api.signInEmail({
      body: {
        ...parsed.data,
        rememberMe: data.get("rememberMe") === "on",
        callbackURL: VERIFICADO,
      },
      headers: await headers(),
    });
  } catch (e) {
    return toState(e);
  }
  redirect(resolveAfterLogin(field(data, "volver") || null));
}

export async function signUpAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z
    .object({ name: z.string().trim().min(1).max(100), email, password })
    .safeParse({
      name: field(data, "name"),
      email: field(data, "email"),
      password: field(data, "password"),
    });
  if (!parsed.success) return error(MSG.datos);

  try {
    await getAuth().api.signUpEmail({
      body: { ...parsed.data, callbackURL: VERIFICADO },
      headers: await headers(),
    });
  } catch (e) {
    return toState(e);
  }
  redirect("/cuenta/verificar");
}

// Responde igual exista o no la cuenta. Solo el límite de intentos se muestra.
async function sendLink(
  data: FormData,
  call: (email: string, headers: Headers) => Promise<unknown>,
): Promise<FormState> {
  const parsed = email.safeParse(field(data, "email"));
  if (!parsed.success) return error(MSG.datos);
  try {
    await call(parsed.data, await headers());
  } catch (e) {
    if (isAPIError(e) && e.statusCode === 429) return error(MSG.limite);
  }
  return { status: "success", message: MSG.enviado };
}

export async function requestResetAction(_: FormState, data: FormData) {
  return sendLink(data, (email, headers) =>
    getAuth().api.requestPasswordReset({
      body: { email, redirectTo: "/cuenta/nueva-contrasena" },
      headers,
    }),
  );
}

export async function resendVerificationAction(_: FormState, data: FormData) {
  return sendLink(data, (email, headers) =>
    getAuth().api.sendVerificationEmail({
      body: { email, callbackURL: VERIFICADO },
      headers,
    }),
  );
}

export async function resetPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z
    .object({ token: z.string().min(1), newPassword: password })
    .safeParse({ token: field(data, "token"), newPassword: field(data, "password") });
  if (!parsed.success) return error(MSG.datos);

  try {
    await getAuth().api.resetPassword({ body: parsed.data, headers: await headers() });
  } catch (e) {
    return toState(e);
  }
  redirect("/cuenta/login?estado=contrasena-actualizada");
}

export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}
