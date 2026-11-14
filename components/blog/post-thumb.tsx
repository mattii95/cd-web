import { Cloud, Code, Layers, Sparkles } from "@/components/icons";
import type { BlogCategoryTag } from "@/lib/blog-posts";

// Ícono de la miniatura según la categoría del post.
const thumbIcons = {
  sistemas: Layers,
  saas: Cloud,
  ia: Sparkles,
  "desarrollo-web": Code,
};

export function PostThumb({
  category,
  large = false,
}: {
  category: BlogCategoryTag;
  large?: boolean;
}) {
  const Icon = thumbIcons[category];
  return (
    <div
      aria-hidden="true"
      className={`relative flex ${large ? "min-h-[340px]" : "aspect-video"} items-center justify-center overflow-hidden bg-background bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]`}
    >
      <span className="fx-orb fx-orb1 top-[-10%] left-[22%] aspect-square w-[55%] bg-accent/45 blur-[50px]" />
      <span className="fx-ring absolute aspect-square w-[44%] rounded-full border border-dashed border-accent-light/45" />
      <span
        className={`relative flex ${large ? "size-22 rounded-[22px]" : "size-16 rounded-2xl"} items-center justify-center bg-accent text-white shadow-[0_0_40px_rgba(26,102,245,0.7)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:-translate-y-1.5 group-hover:scale-[1.03]`}
      >
        <Icon size={large ? 40 : 28} />
      </span>
      <span className="absolute bottom-3 left-4 font-mono text-[11px] text-accent-softer">
        {`// ${category}`}
      </span>
    </div>
  );
}
