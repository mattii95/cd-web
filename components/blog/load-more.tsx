import { FormMessage } from "@/components/auth/form-message";

// Botón "Cargar más" / "Ver más comentarios": mismo pill que los filtros del blog.
export function LoadMore({
  label,
  errorMessage,
  loading,
  failed,
  onClick,
}: {
  label: string;
  errorMessage: string;
  loading: boolean;
  failed: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {failed && (
        <FormMessage state={{ status: "error", message: errorMessage }} />
      )}
      <button
        type="button"
        disabled={loading}
        aria-busy={loading}
        onClick={onClick}
        className="min-h-12 cursor-pointer rounded-full border border-paper-border bg-white px-7 py-3 text-[15px] font-semibold text-[#2b3449] transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-paper-border disabled:hover:text-[#2b3449]"
      >
        {loading ? "Cargando…" : label}
      </button>
    </div>
  );
}
