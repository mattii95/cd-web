"use client";

import { type ComponentProps, useState } from "react";
import { Eye, EyeOff } from "@/components/icons";
import { inputClass, labelClass } from "./field-styles";

export function PasswordInput({
  label = "Contraseña",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className={labelClass}>
      {label}
      <span className="relative block">
        <input
          {...props}
          type={show ? "text" : "password"}
          className={`${inputClass} pr-[52px]`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-1 bottom-[3px] flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent text-[#5B6478]"
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </span>
    </label>
  );
}
