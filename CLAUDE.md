# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario.

## Stack

Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript (strict), Tailwind CSS v4. Freshly scaffolded from `create-next-app` — `app/page.tsx` is still the template page.

Because this Next.js version is newer than most training data, check `node_modules/next/dist/docs/` (`01-app/` for App Router guides and API reference) before using any Next.js API.

## Architecture notes

- **App Router only**, at the repo root (`app/`, no `src/`). Path alias `@/*` maps to the repo root.
- **`next.config.ts` enables non-default features** that change how code must be written:
  - `cacheComponents: true` — Cache Components / PPR model: dynamic data access must be inside `<Suspense>` or explicitly cached with `"use cache"`. Read the caching docs before fetching data in pages/layouts.
  - `partialPrefetching: true`
  - `experimental.agentFeedback: true`
- **Tailwind v4 via a Turbopack loader**: CSS is processed by `@tailwindcss/turbopack` (configured under `turbopack.rules` in `next.config.ts`), not PostCSS — there is no `postcss.config` or `tailwind.config`. Theme tokens live in `app/globals.css` via `@theme inline`, with light/dark CSS variables (`--background`, `--foreground`) switched by `prefers-color-scheme`.
- **Typed route helpers**: layouts/pages use global generated types like `LayoutProps<"/">` / `PageProps<"/route">` (generated into `.next/types` — run `dev` or `build` if they're missing).
- Fonts: Geist / Geist Mono via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono` and mapped to Tailwind's `font-sans` / `font-mono`.
