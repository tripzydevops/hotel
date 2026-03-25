# Hotel Project: Technical Standards & Requirements

This document serves as the "Source of Truth" for the project's architecture and technology stack to prevent the regression to experimental versions and ensure production stability.

## 1. Core Technology Stack (Locked)

| Component | Stable Version | Rationale |
| :--- | :--- | :--- |
| **Next.js** | `^15.x` | Required for compatibility with InsForge middleware and stable Vercel builds. |
| **Tailwind CSS** | `3.4.x` | Ensures compatibility with existing PostCSS pipelines and prevents `ScannerOptions` errors. |
| **React** | `19.0.x` | Standard minor version for the current feature set. Avoid `19.2.x` until peer dependencies align. |
| **Node.js** | `>=20.0.0` | Production runtime standard. |

## 2. Configuration Standards

### Tailwind & CSS
- **Do not use `@import "tailwindcss"`**: Always use the standard directives (`@tailwind base`, etc.) in `globals.css`.
- **Maintain `tailwind.config.ts`**: All design tokens (colors, fonts) must be defined here for IDE support and consistent branding.
- **PostCSS**: Use the standard `tailwindcss` and `autoprefixer` plugins in `postcss.config.mjs`.

### API & Backend Integration
- **Rewrites over CORS**: Always use `next.config.ts` rewrites for `/api/:path*` to avoid cross-origin issues.
- **Backend URL**: The current system points to `https://pa5riyqv.eu-central.insforge.app`. Any change to this must be mirrored in the `.env` and `next.config.ts`.

## 3. Development Workflow
- **Build Verification**: Every major change *must* be verified with `npm run build` locally before pushing.
- **Dependency Management**: Never use the `--force` flag during installation without manual audit. 
- **Type Safety**: The project enforces strict TypeScript rules. Do not use `ignoreBuildErrors: true` in production.

## 4. Known Gotchas
- **Leaflet Type Definitions**: Always ensure `@types/leaflet` is present in `devDependencies` if using map components.
- **Turbopack Compatibility**: Tailwind 4 features are currently incompatible with the project's Turbopack build pipeline.
