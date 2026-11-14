const labels = ["Escribí una contraseña", "Débil", "Media", "Buena", "Fuerte"];

export function getScore(pw: string) {
  return [
    pw.length >= 8,
    /[A-Z]/.test(pw) && /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
}

export function PasswordStrength({ password }: { password: string }) {
  const score = password ? getScore(password) : 0;
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`block h-1.5 rounded-[3px] ${
              n <= score
                ? "bg-accent shadow-[0_0_10px_rgba(77,139,255,0.7)]"
                : "bg-paper-border"
            }`}
          />
        ))}
      </div>
      <span className="flex justify-between gap-2 text-[13px] text-text-faint">
        <span>
          Seguridad: <strong className="text-ink">{labels[password ? Math.max(score, 1) : 0]}</strong>
        </span>
        <span>8+ caracteres, mayúsculas, números y símbolos</span>
      </span>
    </div>
  );
}
