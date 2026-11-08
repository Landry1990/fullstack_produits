// Prefetch helper - charge en arrière-plan (immédiat : import() est déjà
// non-bloquant, le différer via requestIdleCallback retardait le chunk
// jusqu'après le clic → effet "double clic nécessaire")
export function prefetchRoute(factory: () => Promise<unknown>) {
  factory().catch(() => {}); // Silencieux si erreur
}

// Précharge TOUTES les routes en arrière-plan après connexion :
// chaque chunk est ainsi déjà en cache quand l'utilisateur clique.
// Séquencé en petits lots via requestIdleCallback pour ne pas saturer
// le navigateur au login.
export function warmupRoutes(factories: (() => Promise<unknown>)[]) {
  let index = 0;
  const step = () => {
    const batch = factories.slice(index, index + 4);
    index += batch.length;
    batch.forEach(f => f().catch(() => {}));
    if (index < factories.length) schedule(step);
  };
  const schedule = (fn: () => void) => {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1500 });
    else setTimeout(fn, 150);
  };
  schedule(step);
}
