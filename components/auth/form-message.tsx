import type { FormState } from "@/app/cuenta/actions";

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className="m-0 rounded-xl border border-accent/30 bg-accent-tint px-4 py-3 text-sm leading-normal text-ink"
    >
      {state.message}
    </p>
  );
}
