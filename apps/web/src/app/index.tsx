/**
 * apps/web/src/app/index.tsx
 *
 * App shell — global providers, router, and theme.
 * This is the composition root. No business logic here.
 *
 * Typical structure:
 *   <QueryClientProvider>     ← React Query
 *     <ThemeProvider>         ← ui_library theme (MUI/Chakra/etc.)
 *       <Router>              ← React Router or TanStack Router
 *         <Suspense>          ← Route-level lazy loading boundary
 *           <Routes />
 *         </Suspense>
 *       </Router>
 *     </ThemeProvider>
 *   </QueryClientProvider>
 */

// Add your app providers and router here.
// Keep this file thin — delegate to pages/ and features/.
