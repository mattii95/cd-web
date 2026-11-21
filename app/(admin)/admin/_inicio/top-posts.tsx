import Link from "next/link";
import type { TopPost } from "@/db/admin-dashboard";
import { SectionCard, SectionEmpty } from "./section-card";

// En móvil cada fila se apila y cada celda muestra su columna con data-label (como la tabla de usuarios).
const cell =
  "block px-0 py-0.5 before:mr-2 before:font-normal before:text-cms-muted before:content-[attr(data-label)':'] md:table-cell md:px-3 md:py-3 md:text-right md:align-middle md:before:content-none";

export function TopPosts({ items, scope }: { items: TopPost[]; scope: string }) {
  return (
    <SectionCard title="Top artículos" scope={scope}>
      {items.length === 0 ? (
        <SectionEmpty
          text="Ningún artículo tuvo comentarios ni valoraciones en este período."
          className="h-40"
        />
      ) : (
        <table className="w-full border-collapse text-left text-[15px] text-cms-text">
          <thead className="sr-only md:not-sr-only">
            <tr className="border-b border-cms-line-soft text-sm text-cms-muted">
              <th scope="col" className="w-1/2 px-0 py-2 font-semibold md:pr-3">Artículo</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Comentarios</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Valoraciones</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Promedio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cms-line-soft">
            {items.map((p) => (
              <tr key={p.id} className="block py-3 md:table-row md:py-0">
                <th scope="row" className="block min-h-11 px-0 py-0.5 text-left font-normal md:table-cell md:py-3 md:pr-3 md:align-middle">
                  <Link
                    href={`/admin/articles/${p.id}/edit`}
                    className="inline-flex min-h-11 items-center font-semibold text-cms-link underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </Link>
                </th>
                <td data-label="Comentarios" className={cell}>{p.comments}</td>
                <td data-label="Valoraciones" className={cell}>{p.ratings}</td>
                <td data-label="Promedio" className={cell}>
                  {p.average === null ? "—" : `${p.average.toFixed(1).replace(".", ",")} ★`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
