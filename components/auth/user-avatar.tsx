"use client";

import Image from "next/image";
import { useState } from "react";

// Foto del proveedor, o la inicial si no hay foto o falla al cargar.
// `image` ya pasó por avatarSrc: solo hosts permitidos.
export function UserAvatar({ name, image }: { name: string; image: string | null }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (image && image !== failedImage) {
    return (
      <Image
        src={image}
        alt=""
        width={32}
        height={32}
        onError={() => setFailedImage(image)}
        className="size-8 rounded-full object-cover"
      />
    );
  }
  return <>{name.trim().charAt(0).toUpperCase()}</>;
}
