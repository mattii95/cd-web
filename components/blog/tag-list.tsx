import type { BlogTag } from "@/lib/blog-posts";

// Chips de solo texto: el filtro vive únicamente en /blog.
const tones = {
  light: "border-paper-border text-text-faint",
  dark: "border-white/15 text-text-muted",
};

export function TagList({
  tags,
  tone = "light",
}: {
  tags: BlogTag[];
  tone?: keyof typeof tones;
}) {
  if (tags.length === 0) return null;
  return (
    <ul
      aria-label="Etiquetas"
      className="m-0 flex list-none flex-wrap gap-1.5 p-0"
    >
      {tags.map((t) => (
        <li
          key={t.slug}
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
        >
          {t.name}
        </li>
      ))}
    </ul>
  );
}
