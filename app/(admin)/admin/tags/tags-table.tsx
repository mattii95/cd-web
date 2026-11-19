import type { AdminTagRow } from "@/db/admin-tags";
import { TagRowMenu } from "./tag-row-menu";

// En móvil cada fila se apila y cada celda muestra su columna con data-label.
const cell =
  "block px-0 py-1 before:mr-2 before:font-normal before:text-cms-muted before:content-[attr(data-label)':'] md:table-cell md:px-5 md:py-3.5 md:before:content-none";

export function TagsTable({ items }: { items: AdminTagRow[] }) {
  return (
    <table aria-label="Listado de etiquetas" className="block w-full border-collapse text-left text-[15px] md:table">
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="border-b border-cms-line bg-cms-head text-xs tracking-wide text-cms-text">
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Etiqueta</th>
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Slug</th>
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Artículos</th>
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Más acciones</th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {items.map((t) => (
          <tr
            key={t.id}
            className="block border-b border-cms-line-soft px-5 py-3 last:border-b-0 md:table-row md:px-0 md:py-0"
          >
            <td data-label="Etiqueta" className={`${cell} min-w-0 font-semibold text-cms-ink md:max-w-xs [overflow-wrap:break-word]`}>
              {t.name}
            </td>
            <td data-label="Slug" className={`${cell} font-mono text-sm text-cms-text [overflow-wrap:break-word]`}>
              {t.slug}
            </td>
            <td data-label="Artículos" className={`${cell} text-cms-text`}>
              {t.published} publicados · {t.total} en total
            </td>
            <td data-label="Más acciones" className={cell}>
              <TagRowMenu tag={t} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
