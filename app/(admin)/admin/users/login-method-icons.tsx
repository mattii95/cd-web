import { Mail } from "@/components/icons";
import type { LoginMethod } from "@/lib/auth/dal";

const LABEL: Record<LoginMethod, string> = {
  credential: "Email y contraseña",
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
};

const ICON: Record<LoginMethod, React.ReactNode> = {
  credential: <Mail size={18} />,
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-10.7-3.78H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.37 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.4a12 12 0 0 0 0 10.82l3.97-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.4 6.59l3.97 3.1A7.15 7.15 0 0 1 12 4.77Z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="size-[18px]">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.26.8-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.76-1.34-1.76-1.08-.74.08-.73.08-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3Z" />
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  ),
};

export function LoginMethodIcons({ methods }: { methods: LoginMethod[] }) {
  if (methods.length === 0) return <span className="whitespace-nowrap text-cms-muted">Sin acceso</span>;
  return (
    <ul className="m-0 flex list-none items-center gap-2 p-0">
      {methods.map((m) => (
        <li
          key={m}
          title={LABEL[m]}
          className="flex size-7 items-center justify-center rounded-md border border-cms-line-soft bg-cms-panel-alt text-cms-text"
        >
          <span role="img" aria-label={LABEL[m]} className="flex">
            {ICON[m]}
          </span>
        </li>
      ))}
    </ul>
  );
}
