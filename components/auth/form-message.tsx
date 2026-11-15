import type { FormState } from "@/app/cuenta/actions";

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`m-0 rounded-xl border px-4 py-3 text-sm leading-normal ${
        isError
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-accent/30 bg-accent-tint text-ink"
      }`}
    >
      {state.message}
    </p>
  );
}
