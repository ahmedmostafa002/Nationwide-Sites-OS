# Nationwide Local-Site Generator

Monorepo foundation for a `Next.js + Astro` nationwide local-site generator.

## Apps

- `apps/studio`: internal studio for project setup, geo import, AI settings, and export workflow
- `apps/site`: Astro output app for SEO-first frontends
- `packages/shared`: shared schemas and types

## Getting Started

1. Copy `.env.example` to `.env`.
2. Add your provider keys locally.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev:studio` or `pnpm dev:site`.
