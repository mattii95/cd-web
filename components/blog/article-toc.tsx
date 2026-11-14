import type { BlogBlock } from "@/lib/blog-posts";

export function ArticleToc({
  body,
  hasReviews,
}: {
  body: BlogBlock[];
  hasReviews: boolean;
}) {
  const headings = body.filter((b) => b.type === "h2");
  return (
    <div className="rounded-[18px] border border-paper-border bg-white p-[22px]">
      <span className="font-mono text-xs text-text-faint">
        {"// en este artículo"}
      </span>
      <nav aria-label="Índice" className="mt-2.5 flex flex-col">
        {headings.map((h, i) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className="flex gap-2.5 py-2 text-sm leading-[1.45] text-[#2b3449] no-underline hover:text-accent"
          >
            <span className="font-mono text-xs text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            {h.text}
          </a>
        ))}
        {hasReviews && (
          <a
            href="#valoraciones"
            className="flex gap-2.5 py-2 text-sm leading-[1.45] text-[#2b3449] no-underline hover:text-accent"
          >
            <span aria-hidden="true" className="font-mono text-xs text-accent">
              ★
            </span>
            Valoraciones y comentarios
          </a>
        )}
      </nav>
    </div>
  );
}
