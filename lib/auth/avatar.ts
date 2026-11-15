// next/image lanza con un host fuera de `remotePatterns`: solo pasan los de Google y GitHub.
const HOSTS = ["lh3.googleusercontent.com", "avatars.githubusercontent.com"];

export function avatarSrc(image: string | null): string | null {
  if (!image) return null;
  try {
    const url = new URL(image);
    return url.protocol === "https:" && HOSTS.includes(url.hostname) ? image : null;
  } catch {
    return null;
  }
}
