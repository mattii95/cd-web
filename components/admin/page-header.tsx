import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="m-0 font-display text-[clamp(30px,3vw,40px)] leading-[1.1] font-bold tracking-[-0.02em] text-cms-ink">
          {title}
        </h1>
        {description && (
          <p className="m-0 mt-2 max-w-[60ch] text-base text-cms-text">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
