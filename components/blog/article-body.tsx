import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Bolt } from "@/components/icons";
import type {
  BlogInline,
  BlogListItem,
  BlogMark,
  BlogNestedNode,
  ResolvedBlogDoc,
} from "@/db/blog-body";

// Color del enlace según el fondo: el acento no llega a 4.5:1 sobre accent-tint.
const LINK = {
  paper: "text-accent hover:text-accent-hover",
  tint: "text-accent-hover hover:text-ink",
  dark: "text-accent-pale hover:text-white",
} as const;
type Tone = keyof typeof LINK;

const isExternal = (href: string) => /^https?:\/\//.test(href);

function applyMark(mark: BlogMark, child: ReactNode, tone: Tone): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{child}</strong>;
    case "italic":
      return <em>{child}</em>;
    case "link": {
      const { href } = mark.attrs;
      const cls = `underline decoration-1 underline-offset-[3px] transition-colors ${LINK[tone]}`;
      return isExternal(href) ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {child}
        </a>
      ) : (
        <Link href={href} className={cls}>
          {child}
        </Link>
      );
    }
  }
}

function Inlines({
  nodes = [],
  tone = "paper",
}: {
  nodes?: BlogInline[];
  tone?: Tone;
}) {
  return nodes.map((n, i) =>
    n.type === "hardBreak" ? (
      <br key={i} />
    ) : (
      <Fragment key={i}>
        {(n.marks ?? []).reduce<ReactNode>(
          (child, mark) => applyMark(mark, child, tone),
          n.text,
        )}
      </Fragment>
    ),
  );
}

const PARAGRAPH = "m-0 text-lg leading-[1.8] text-[#2b3449]";
const LIST =
  "m-0 flex flex-col gap-2 pl-6 text-lg leading-[1.8] text-[#2b3449] marker:text-accent";

function ListItem({ item }: { item: BlogListItem }) {
  return (
    <li className="pl-1 [&>ol]:mt-2 [&>ul]:mt-2">
      {item.content.map((n, i) => (
        <Nested key={i} node={n} />
      ))}
    </li>
  );
}

// Lo que puede ir en la raíz, dentro de listas y dentro de citas.
function Nested({ node }: { node: BlogNestedNode }) {
  switch (node.type) {
    case "paragraph":
      return node.content?.length ? (
        <p className={PARAGRAPH}>
          <Inlines nodes={node.content} />
        </p>
      ) : null;
    case "bulletList":
      return (
        <ul className={`${LIST} list-disc`}>
          {node.content.map((it, i) => (
            <ListItem key={i} item={it} />
          ))}
        </ul>
      );
    case "orderedList": {
      const start = node.attrs?.start;
      return (
        <ol
          start={start && start !== 1 ? start : undefined}
          className={`${LIST} list-decimal`}
        >
          {node.content.map((it, i) => (
            <ListItem key={i} item={it} />
          ))}
        </ol>
      );
    }
    case "blockquote":
      return (
        <blockquote className="m-0 my-2 flex flex-col gap-3 border-l-[3px] border-accent pl-5 italic">
          {node.content.map((n, i) => (
            <Nested key={i} node={n} />
          ))}
        </blockquote>
      );
  }
}

export function ArticleBody({ body }: { body: ResolvedBlogDoc }) {
  const h2s = body.content.filter(
    (n) => n.type === "heading" && n.attrs.level === 2,
  );
  return (
    <article className="flex max-w-[760px] min-w-0 flex-col gap-5">
      {body.content.map((node, i) => {
        switch (node.type) {
          case "heading":
            if (node.attrs.level === 3) {
              return (
                <h3
                  key={i}
                  className="m-0 mt-2 font-display text-[21px] leading-[1.3] font-bold tracking-[-0.01em]"
                >
                  <Inlines nodes={node.content} />
                </h3>
              );
            }
            const n = h2s.indexOf(node) + 1;
            return (
              <h2
                key={i}
                id={`s${n}`}
                className="m-0 mt-4 flex items-baseline gap-3.5 font-display text-[28px] leading-[1.2] font-bold tracking-[-0.015em]"
              >
                <span className="font-mono text-base text-accent">
                  {String(n).padStart(2, "0")}
                </span>
                <span>
                  <Inlines nodes={node.content} />
                </span>
              </h2>
            );
          case "tip":
            return (
              <aside
                key={i}
                className="fx-beam relative my-2 flex items-start gap-4 overflow-hidden rounded-[18px] bg-[#050b1c] px-[26px] py-6 text-white"
              >
                <span className="fx-dot flex size-9 flex-none items-center justify-center rounded-[10px] bg-accent">
                  <Bolt size={18} />
                </span>
                <span className="flex flex-col gap-1.5">
                  <strong className="font-display text-[17px]">Consejo</strong>
                  <span className="text-base leading-[1.6] text-text">
                    <Inlines nodes={node.content} tone="dark" />
                  </span>
                </span>
              </aside>
            );
          case "image":
            return (
              <figure key={i} className="m-0 my-2 flex flex-col gap-3">
                <Image
                  src={node.attrs.image.src}
                  width={node.attrs.image.width}
                  height={node.attrs.image.height}
                  alt={node.attrs.image.alt}
                  sizes="(min-width: 800px) 760px, 100vw"
                  className="h-auto w-full rounded-[18px] border border-paper-border"
                />
                {node.attrs.caption && (
                  <figcaption className="text-sm leading-[1.5] text-text-faint">
                    {node.attrs.caption}
                  </figcaption>
                )}
              </figure>
            );
          case "summary":
            return (
              <aside
                key={i}
                className="my-2 flex flex-col gap-1.5 rounded-[18px] border border-[#c9d9fb] bg-accent-tint px-[26px] py-6"
              >
                <strong className="font-display text-[17px]">En resumen</strong>
                <span className="text-base leading-[1.6] text-[#2b3449]">
                  <Inlines nodes={node.content} tone="tint" />
                </span>
              </aside>
            );
          default:
            return <Nested key={i} node={node} />;
        }
      })}
    </article>
  );
}
