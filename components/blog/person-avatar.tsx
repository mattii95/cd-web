import Image from "next/image";
import { avatarSrc } from "@/lib/auth/avatar";
import { getInitials } from "@/lib/initials";

// Foto si existe (y viene de un host permitido); si no, las iniciales en el mismo círculo.
export function PersonAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image: string | null;
  className: string; // tamaño y texto: "size-10 text-sm"
}) {
  const src = avatarSrc(image);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-mono font-semibold text-white ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={64}
          height={64}
          className="size-full object-cover"
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
