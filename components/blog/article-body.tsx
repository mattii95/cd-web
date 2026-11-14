import { Bolt } from "@/components/icons";
import type { BlogBlock } from "@/lib/blog-posts";

export function ArticleBody({ body }: { body: BlogBlock[] }) {
  let h2Count = 0;
  return (
    <article className="flex max-w-[760px] min-w-0 flex-col gap-5">
      {body.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="m-0 text-lg leading-[1.8] text-[#2b3449]">
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2
                key={block.id}
                id={block.id}
                className="m-0 mt-4 flex items-baseline gap-3.5 font-display text-[28px] leading-[1.2] font-bold tracking-[-0.015em]"
              >
                <span className="font-mono text-base text-accent">
                  {String(++h2Count).padStart(2, "0")}
                </span>
                {block.text}
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
                    {block.text}
                  </span>
                </span>
              </aside>
            );
          case "summary":
            return (
              <aside
                key={i}
                className="my-2 flex flex-col gap-1.5 rounded-[18px] border border-[#c9d9fb] bg-accent-tint px-[26px] py-6"
              >
                <strong className="font-display text-[17px]">En resumen</strong>
                <span className="text-base leading-[1.6] text-[#2b3449]">
                  {block.text}
                </span>
              </aside>
            );
        }
      })}
    </article>
  );
}
