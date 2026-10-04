# Repository Guidelines

## Project Structure

This repository is a Next.js App Router application. The main user interface is in `app/page.tsx`, with shared styles in `app/globals.css` and document metadata in `app/layout.tsx`. The image-generation endpoint is `app/api/kirkify/route.ts`. Static assets belong in `public/`. Deployment notes are in `DEPLOYMENT_GUIDE.md`.

## Build, Test, and Development

- `npm run dev` starts the local development server at `http://localhost:3000`.
- `npm run build` creates and type-checks the production build.
- `npm run start` serves the latest production build.
- `npm run lint` runs the repository ESLint configuration.
- `npx tsc --noEmit` performs a standalone TypeScript check.

There is currently no test framework or test suite. For API changes, validate both OpenAI-compatible and Gemini flows with a real image and verify error responses for missing keys, malformed data URLs, and provider failures.

## Coding Style

Use TypeScript and React function components. Follow the existing four-space indentation and double-quoted strings. Keep browser-only behavior in client components marked with `"use client"`; keep provider credentials and external API calls in server routes. Use descriptive camelCase names for variables and functions, PascalCase for components, and kebab-case for CSS class names. Run `npm run lint` before submitting changes.

## Configuration and Security

Local secrets belong in `.env.local` and must never be committed. Server defaults include `OPENROUTER_API_KEY` and `GEMINI_API_KEY`; user-entered keys are stored in browser local storage for this local tool. Treat uploaded images and provider responses as untrusted input, validate data URLs, and avoid returning full upstream responses or credentials in errors.

## Commits and Pull Requests

Use short imperative commit subjects with the existing `feat:` or `fix:` prefixes, for example `feat: add Gemini image model`. Keep commits focused. Pull requests should explain user-visible behavior, identify provider/API changes, include validation commands, and attach a screenshot for UI changes. Mention any required environment variables or migration steps.
