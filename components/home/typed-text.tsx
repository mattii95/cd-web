"use client";

import { useEffect, useState } from "react";

const words = [
  "desarrollo web",
  "sistemas a medida",
  "productos SaaS",
  "agentes de IA",
];

// Arranca mostrando la primera palabra completa (también en el servidor, sin
// JS y con reduced-motion). Si el usuario no pidió menos movimiento, después
// de una pausa empieza el ciclo de borrar y escribir.
export function TypedText() {
  const [text, setText] = useState(words[0]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let wordIndex = 0;
    let charIndex = words[0].length;
    let deleting = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = words[wordIndex];
      let delay = 85 + Math.random() * 60;

      if (!deleting) {
        charIndex++;
        if (charIndex >= word.length) {
          charIndex = word.length;
          deleting = true;
          delay = 1800;
        }
      } else {
        charIndex--;
        delay = 38;
        if (charIndex <= 0) {
          charIndex = 0;
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          delay = 400;
        }
      }

      setText(words[wordIndex].slice(0, charIndex));
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {text}
      <span className="fx-caret ml-[0.12em] inline-block h-[1em] w-[0.55em] bg-accent-light shadow-[0_0_16px_rgba(77,139,255,0.9)]" />
    </>
  );
}
