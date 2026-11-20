"use client";

import { useState } from "react";
import { UploadDialog } from "./upload-dialog";

// Vive en la cabecera: la grilla se remonta con cada subida, así que no puede alojar el modal.
export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        id="media-upload-open"
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-accent bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Subir imágenes
      </button>
      {open && <UploadDialog onClose={() => setOpen(false)} />}
    </>
  );
}
