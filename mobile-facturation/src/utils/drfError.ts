// Extrait le 1er message d'erreur d'une réponse DRF (detail ou champ).
export function drfError(data: unknown, fallback: string): string {
  const d = data as Record<string, unknown> | undefined;
  if (d?.detail && typeof d.detail === 'string') return d.detail;
  if (d) {
    for (const v of Object.values(d)) {
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
      if (typeof v === 'string') return v;
    }
  }
  return fallback;
}
