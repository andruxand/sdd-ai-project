# Skill: core-web-vitals

> Source: web.dev/articles/lcp, web.dev Core Web Vitals, github.com/GoogleChrome/web-vitals, vitejs.dev/guide
> Type: **active** — loaded by `frontend-implementer` and `reviewer` agents

## Purpose

Provide actionable Core Web Vitals implementation knowledge for **React + Vite** applications (this project uses Vite, not Next.js — do NOT apply `next/image`, `next/link`, ISR/SSG, or `next.config.ts` patterns). Covers the three stable metrics (LCP, INP, CLS), their thresholds, Vite-compatible optimization techniques, the `web-vitals` library, `lighthouse-ci` in GitHub Actions, and cache header strategy.

---

## The three stable Core Web Vitals (2024)

| Metric  | Full name                 | Good     | Needs improvement | Poor     |
| ------- | ------------------------- | -------- | ----------------- | -------- |
| **LCP** | Largest Contentful Paint  | ≤ 2.5 s  | 2.5–4.0 s         | > 4.0 s  |
| **INP** | Interaction to Next Paint | ≤ 200 ms | 200–500 ms        | > 500 ms |
| **CLS** | Cumulative Layout Shift   | ≤ 0.1    | 0.1–0.25          | > 0.25   |

**Measurement target:** p75 of real-user page loads (field data), segmented by mobile and desktop.

**INP replaced FID** as a stable Core Web Vital in March 2024. Use INP — FID is deprecated.

---

## LCP — Largest Contentful Paint

**What it measures:** Time from navigation start to when the largest visible content element (image, text block, or video poster) is rendered.

**LCP candidate elements:** `<img>`, `<image>` inside `<svg>`, `<video>` (poster), CSS `url()` background images, block-level text.

### Optimization: Vite + React (native img with preload)

Vite does not have a built-in `<Image>` component. Use native `<img>` with proper attributes and a `<link rel="preload">` for the LCP element.

```tsx
// ✅ Hero image — manually add preload link in index.html for LCP image
// In apps/web/index.html:
// <link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

export function Hero() {
  return (
    <img
      src="/hero.webp"
      alt="Product hero image"
      width={1200}
      height={600}
      // No loading="lazy" on LCP image — browsers lazy-load by default on non-priority images
      fetchPriority="high"
      decoding="async"
    />
  );
}

// ✅ Below-fold images — use lazy loading
export function ProductCard({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={400}
      height={300}
      loading="lazy"
      decoding="async"
    />
  );
}
```

**Vite image import (with width/height auto-inlining):**

```tsx
// Use vite-imagetools or @unpic/react for advanced image optimization in Vite.
// For CDN-hosted images (CloudFront): serve pre-converted WebP/AVIF at build time.
import heroUrl from './assets/hero.webp?url';
```

### LCP optimization checklist (Vite + React)

- [ ] LCP image has `fetchPriority="high"` and NO `loading="lazy"`.
- [ ] LCP image is `<link rel="preload" as="image" fetchpriority="high">` in `index.html`.
- [ ] All below-fold images have `loading="lazy"`.
- [ ] Serve images from CloudFront CDN with `Cache-Control: max-age=31536000, immutable` for hashed assets.
- [ ] Use WebP/AVIF format (convert at build time with `vite-imagetools` or pre-convert in CI).
- [ ] Images have explicit `width` and `height` attributes to prevent layout shift (CLS).
- [ ] Avoid render-blocking resources above the fold (no synchronous CSS imports that delay paint).

---

## INP — Interaction to Next Paint

**What it measures:** The latency of the worst (p98) interaction in a user session — measures responsiveness.

**INP includes:** all pointer events, keyboard events, and touch events. It replaced FID because FID only measured the _first_ interaction.

### Optimization techniques

```tsx
// ✅ Break up long tasks with useTransition (React 18+)
import { useTransition, useState } from 'react';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    startTransition(() => {
      // This update is non-urgent — React can interrupt it
      setResults(filterResults(e.target.value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} aria-busy={isPending} />
      {isPending ? <Spinner /> : <ResultList results={results} />}
    </>
  );
}

// ✅ Debounce expensive handlers
import { useMemo } from 'react';
import { debounce } from 'lodash-es';

function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const debouncedSearch = useMemo(() => debounce(onSearch, 200), [onSearch]);
  return <input onChange={(e) => debouncedSearch(e.target.value)} />;
}
```

### INP optimization checklist

- [ ] Avoid long synchronous work (>50 ms) in event handlers.
- [ ] Use `useTransition` for non-urgent state updates.
- [ ] Debounce input handlers.
- [ ] Remove or defer non-critical third-party scripts.
- [ ] Profile with Chrome DevTools > Performance > Interactions.

---

## CLS — Cumulative Layout Shift

**What it measures:** Visual stability — how much page content unexpectedly moves during the user's session.

**Common causes of CLS:** images/videos without explicit dimensions, fonts causing FOIT/FOUT, dynamic content injected above existing content.

### Optimization: explicit dimensions on all media

```tsx
// ✅ next/image prevents CLS automatically by reserving space
<Image src="/card.jpg" alt="Product" width={400} height={300} />

// ✅ For video elements: always specify width and height
<video width={640} height={360} controls>
  <source src="demo.mp4" type="video/mp4" />
</video>

// ✅ Reserve space for dynamic content with aspect-ratio CSS
.card-image-wrapper {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
```

### Optimization: fonts

```tsx
// ✅ Use next/font — zero layout shift (fonts are preloaded)
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });

// ✅ If using custom fonts in CSS:
@font-face {
  font-family: 'MyFont';
  src: url('/fonts/myfont.woff2') format('woff2');
  font-display: swap; /* Prevents invisible text while font loads */
}
```

### CLS optimization checklist

- [ ] All `<img>` and `<Image>` have explicit `width` and `height`.
- [ ] Use `next/font` for all Google/custom fonts.
- [ ] Dynamic content (ads, embeds) has a reserved container with fixed dimensions.
- [ ] Animations use `transform` and `opacity` only (not `width`, `height`, `top`, `left`).
- [ ] Never inject content above existing content without user interaction.

---

## Measuring with the web-vitals library

```typescript
// apps/web/src/lib/web-vitals.ts
import { onCLS, onINP, onLCP } from 'web-vitals';

type MetricEntry = {
  name: string;
  value: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
};

function sendToAnalytics(metric: MetricEntry) {
  // Use sendBeacon for reliability (doesn't block page unload)
  navigator.sendBeacon(
    '/api/vitals',
    JSON.stringify({
      metric: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
    }),
  );
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
}
```

```tsx
// apps/web/src/app/layout.tsx
'use client';
import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/web-vitals';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    reportWebVitals();
  }, []);
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

**Install:**

```bash
npm install web-vitals
```

---

## lighthouse-ci in GitHub Actions

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on:
  pull_request:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npm ci
      - run: npm run build
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:3000/
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

```json
// lighthouse-budget.json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "interactive", "budget": 5000 },
      { "metric": "first-contentful-paint", "budget": 2000 }
    ],
    "scores": [
      { "category": "performance", "minScore": 0.8 },
      { "category": "accessibility", "minScore": 0.95 },
      { "category": "best-practices", "minScore": 0.9 },
      { "category": "seo", "minScore": 0.9 }
    ]
  }
]
```

---

## Cache header strategy for Next.js / CloudFront

| Asset type                        | Cache-Control                            | Rationale                                       |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `/_next/static/*` (hashed JS/CSS) | `max-age=31536000, immutable`            | Content-addressed — safe to cache forever       |
| `/` and other HTML pages          | `no-cache, no-store`                     | Always serve fresh HTML to get new chunk hashes |
| `/api/*`                          | `no-store`                               | API responses should not be cached at CDN       |
| Images in `/_next/image`          | `s-maxage=86400, stale-while-revalidate` | Image optimization cache                        |

```typescript
// next.config.ts — custom Cache-Control headers
const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/((?!_next/static).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};
```

---

## DO / DON'T

| ✅ DO                                           | ❌ DON'T                                     |
| ----------------------------------------------- | -------------------------------------------- |
| Use `next/image` for all images                 | Use `<img>` without `width` and `height`     |
| Add `priority` to LCP image                     | Lazy-load the above-fold hero image          |
| Use `next/font`                                 | Load fonts via `<link>` in `<head>`          |
| Measure INP, not FID                            | Optimize FID (deprecated metric)             |
| Use `useTransition` for non-urgent updates      | Block the main thread in click handlers      |
| Set `Cache-Control: immutable` on hashed assets | Serve hashed JS/CSS without long-lived cache |
| Report vitals with `navigator.sendBeacon`       | Use synchronous XHR in `beforeunload`        |
| Run lighthouse-ci in PR pipeline                | Manually check Lighthouse after deploy       |
