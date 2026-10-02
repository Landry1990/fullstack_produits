/** Helpers pour les paginations basées sur les URLs DRF (next/previous). */

/** Extrait le page_size d'une URL DRF (défaut : PAGE_SIZE backend = 50). */
export function extractPageSize(url: string | null | undefined, fallback = 50): number {
  if (!url) return fallback;
  try {
    const parsed = new URL(url, window.location.origin);
    const v = parseInt(parsed.searchParams.get('page_size') || '', 10);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Retourne une copie de l'URL DRF avec le param `page` remplacé (null si pas d'URL). */
export function buildPageUrl(url: string | null | undefined, page: number): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('page', String(page));
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Nombre de pages à partir d'un count DRF (min 1). */
export function pageCount(count: number | null | undefined, pageSize: number): number {
  return Math.max(1, Math.ceil((count || 0) / pageSize));
}
