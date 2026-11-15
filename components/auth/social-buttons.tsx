"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInSocialAction } from "@/app/cuenta/actions";
import type { SocialProvider } from "@/lib/auth/providers";
import { FormMessage } from "./form-message";

const ICON = "h-5 w-5 flex-none transition-transform duration-300 ease-[cubic-bezier(.2,.9,.3,1.4)] group-enabled:group-hover:scale-125";

const PROVIDERS: Record<SocialProvider, { label: string; icon: ReactNode }> = {
  google: {
    label: "Continuar con Google",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON}>
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-10.7-3.78H1.4v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.37 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.4a12 12 0 0 0 0 10.82l3.97-3.1Z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.4 6.59l3.97 3.1A7.15 7.15 0 0 1 12 4.77Z" />
      </svg>
    ),
  },
  github: {
    label: "Continuar con GitHub",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON} fill="currentColor">
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.26.8-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.76-1.34-1.76-1.08-.74.08-.73.08-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3Z" />
      </svg>
    ),
  },
  microsoft: {
    label: "Continuar con Microsoft",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ICON}>
        <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
        <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
        <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
        <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
      </svg>
    ),
  },
};

function ProviderButton({ provider }: { provider: SocialProvider }) {
  const { pending, data } = useFormStatus();
  const { label, icon } = PROVIDERS[provider];
  return (
    <button
      type="submit"
      name="provider"
      value={provider}
      disabled={pending}
      aria-busy={pending && data?.get("provider") === provider}
      title={label}
      className="group flex min-h-[50px] w-full cursor-pointer items-center justify-center rounded-xl border border-[#C9D3E6] bg-white px-4 text-[15px] font-semibold text-ink transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(.2,.9,.3,1.4)] hover:border-accent hover:bg-accent-tint enabled:hover:-translate-y-1.5 enabled:hover:-rotate-3 enabled:even:hover:rotate-3 enabled:hover:shadow-[0_12px_24px_rgba(26,102,245,.22)] enabled:active:translate-y-0 enabled:active:scale-95 enabled:active:shadow-sm disabled:cursor-wait disabled:opacity-70"
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

// Un solo <form> con un botón por proveedor: así hay un único estado y un único envío a la vez.
export function SocialButtons({
  providers,
  children,
}: {
  providers: SocialProvider[];
  children?: ReactNode; // va entre los botones y el separador (texto legal en registro)
}) {
  const [state, formAction] = useActionState(signInSocialAction, { status: "idle" });
  const volver = useSearchParams().get("volver") ?? "";
  if (providers.length === 0) return null;

  return (
    <>
      <form action={formAction} className="flex flex-col gap-2.5">
        <input type="hidden" name="volver" value={volver} />
        <div className="flex gap-2.5">
          {providers.map((p) => (
            <ProviderButton key={p} provider={p} />
          ))}
        </div>
        <FormMessage state={state} />
      </form>
      {children}
      <div className="flex items-center gap-3 text-sm text-text-faint" role="separator">
        <span className="h-px flex-1 bg-[#C9D3E6]" />
        o con tu email
        <span className="h-px flex-1 bg-[#C9D3E6]" />
      </div>
    </>
  );
}
