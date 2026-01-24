---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering.
---

# Vercel React Best Practices

Guidelines for writing performant React and Next.js applications, sourced from Vercel Engineering.

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- **async-defer-await**: Move await into branches where actually used. Don't block whole scope if not needed immediately.
- **async-parallel**: Use `Promise.all()` for independent asynchronous operations.
- **async-dependencies**: Use techniques to start dependent promises as early as possible.
- **async-api-routes**: Start promises early, await late in API routes.
- **async-suspense-boundaries**: Use Suspense to stream content while data fetches.

### 2. Bundle Size Optimization (CRITICAL)

- **bundle-barrel-imports**: Import directly from source files, avoid barrel files (index.ts) that re-export everything.
- **bundle-dynamic-imports**: Use `next/dynamic` for heavy components (charts, maps, etc).
- **bundle-defer-third-party**: Load analytics/logging/chat widgets after hydration or on interaction.
- **bundle-conditional**: Load modules only when feature is activated (e.g. via dynamic import inside handler).
- **bundle-preload**: Preload resources on hover/focus for perceived speed.

### 3. Server-Side Performance (HIGH)

- **server-auth-actions**: Authenticate server actions similar to API routes.
- **server-cache-react**: Use `React.cache()` for per-request deduplication of data fetches.
- **server-cache-lru**: Use LRU cache for cross-request caching if needed.
- **server-dedup-props**: Avoid duplicate serialization in RSC props (pass IDs, not full objects if already identifying).
- **server-serialization**: Minimize data passed to client components (DTOs).
- **server-parallel-fetching**: Restructure components to allow parallel data fetching (hoist fetches).
- **server-after-nonblocking**: Use `after()` (experimental/Next.js specific) for non-blocking cleanup tasks.

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- **client-swr-dedup**: Use SWR or React Query for automatic request deduplication and caching.
- **client-event-listeners**: Deduplicate global event listeners (use singular managed listeners).
- **client-passive-event-listeners**: Use `passive: true` for scroll/touch listeners.
- **client-localstorage-schema**: Version and minimize localStorage data.

### 5. Re-render Optimization (MEDIUM)

- **rerender-defer-reads**: Don't subscribe to state only used in callbacks (use refs).
- **rerender-memo**: Extract expensive work/components into `memo`.
- **rerender-dependencies**: Use stable primitive dependencies in `useEffect`/`useMemo`.
- **rerender-derived-state**: Subscribe to derived booleans/selectors, not raw large state objects.
- **rerender-derived-state-no-effect**: Derive state during render (calculated values), not in `useEffect`.
- **rerender-functional-setstate**: Use functional updates `setState(prev => ...)` for stable callbacks.
- **rerender-transitions**: Use `startTransition` for non-urgent updates to keep UI responsive.

### 6. Rendering Performance (MEDIUM)

- **rendering-animate-svg-wrapper**: Animate a div wrapper, not the SVG element itself (browser optimization).
- **rendering-content-visibility**: Use `content-visibility: auto` for long off-screen lists.
- **rendering-hoist-jsx**: Extract static JSX outside components (constants).
- **rendering-conditional-render**: Use ternary `? :` instead of `&&` for cleaner conditionals (avoids `0` rendering).
- **rendering-usetransition-loading**: Prefer `useTransition` for loading states over manual boolean toggles to keep old UI visible.

### 7. JavaScript Performance (LOW-MEDIUM)

- **js-index-maps**: Build `Map` for repeated lookups (O(1)) instead of array `find` (O(n)).
- **js-cache-property-access**: Cache deep object property access in loops.
- **js-early-exit**: Return early from functions to reduce nesting and processing.
- **js-set-map-lookups**: Use `Set` for O(1) existence checks.
