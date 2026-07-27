// Prefetch helper - charge en arrière-plan au survol
export function prefetchRoute(factory: () => Promise<unknown>) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      factory().catch(() => {}); // Silencieux si erreur
    }, { timeout: 2000 });
  } else {
    setTimeout(() => {
      factory().catch(() => {});
    }, 100);
  }
}
