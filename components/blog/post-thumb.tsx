import Image from "next/image";
import { Cloud, Code, Layers, Sparkles } from "@/components/icons";
import type { BlogCategoryTag, BlogImage } from "@/lib/blog-posts";

// Ícono de la miniatura según la categoría del post.
const thumbIcons = {
  sistemas: Layers,
  saas: Cloud,
  ia: Sparkles,
  "desarrollo-web": Code,
};

const coverSizes = {
  card: "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw",
  featured: "(min-width: 1024px) 600px, 100vw",
  banner: "(min-width: 1200px) 1152px, 100vw",
};

export function PostThumb({
  category,
  cover,
  variant = "card",
}: {
  category: BlogCategoryTag;
  cover?: BlogImage | null;
  variant?: "card" | "featured" | "banner";
}) {
  const Icon = thumbIcons[category];
  const large = variant !== "card";
  const height = {
    card: "aspect-video",
    featured: "min-h-[340px]",
    banner: "h-[clamp(220px,32vw,420px)]",
  }[variant];
  if (cover) {
    const banner = variant === "banner";
    return (
      <div className={`relative ${height} overflow-hidden bg-background`}>
        <Image
          src={cover.src}
          width={cover.width}
          height={cover.height}
          // En tarjetas el título ya es el texto del enlace: la portada es decorativa.
          alt={banner ? cover.alt : ""}
          sizes={coverSizes[variant]}
          fetchPriority={banner ? "high" : undefined}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.03]"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`relative flex ${height} items-center justify-center overflow-hidden bg-background bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]`}
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
