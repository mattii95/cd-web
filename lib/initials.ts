// "Matías Courroux" → "MC", "Ana" → "A": primera letra de las dos primeras palabras.
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join("");
}
