// Solo visual: el login con Google queda para el spec de cuentas.
export function GoogleButton() {
  return (
    <>
      <button
        type="button"
        className="fx-card flex min-h-[50px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-[#C9D3E6] bg-white text-[15px] font-semibold text-ink"
      >
        <span className="flex size-[22px] items-center justify-center rounded-full border-2 border-accent text-xs font-bold text-accent">
          G
        </span>
        Continuar con Google
      </button>
      <div className="flex items-center gap-3 text-[13px] text-text-faint">
        <span className="h-px flex-1 bg-paper-border" />
        o con tu email
        <span className="h-px flex-1 bg-paper-border" />
      </div>
    </>
  );
}
