/**
 * Smoke test des routes frontend.
 *
 * Parse routes.tsx et vérifie que :
 * - chaque composant lazy `lazyWithRetry(() => import('...'))` se charge
 *   et expose un export par défaut (requis par React.lazy),
 * - chaque import eager './components/...' pointe vers un fichier existant,
 * - les paths déclarés sont uniques (pas de collision silencieuse).
 *
 * Auto-alimenté : toute route ajoutée à routes.tsx est couverte sans
 * modifier ce fichier.
 *
 * Lancer : npm run test -- routes
 */
import { describe, expect, it } from 'vitest';
// '?raw' : Vite inline le contenu du fichier en string — pas besoin de node:fs
import routesSrc from './routes.tsx?raw';

// Loaders de tous les composants (clés './components/X.tsx')
const modules = import.meta.glob('./components/**/*.tsx');

// './components/X' (depuis routes.tsx) -> './components/X.tsx' (clé du glob,
// même base src/ pour ce fichier de test)
const toGlobKey = (spec: string) => `${spec}.tsx`;

const lazySpecs = [
    ...routesSrc.matchAll(/lazyWithRetry\(\s*\(\)\s*=>\s*import\('([^']+)'\)/g),
].map((m) => m[1]);

const eagerSpecs = [
    ...routesSrc.matchAll(/^import\s+\w+\s+from\s+'(\.\/components\/[^']+)'/gm),
].map((m) => m[1]);

const declaredPaths = [
    ...routesSrc.matchAll(/\{\s*path:\s*'([^']+)'/g),
].map((m) => m[1]);

describe('routes.tsx — composants lazy', () => {
    it('déclare au moins un composant lazy', () => {
        expect(lazySpecs.length).toBeGreaterThan(0);
    });

    for (const spec of lazySpecs) {
        it(`${spec} se charge et exporte un composant par défaut`, { timeout: 30000 }, async () => {
            const loader = modules[toGlobKey(spec)];
            expect(loader, `module introuvable pour ${spec}`).toBeDefined();
            const mod = (await loader!()) as Record<string, unknown>;
            expect(
                mod.default,
                `${spec} n'a pas d'export par défaut (requis par React.lazy)`,
            ).toBeTruthy();
        });
    }
});

describe('routes.tsx — composants eager', () => {
    for (const spec of eagerSpecs) {
        it(`${spec} existe`, () => {
            expect(
                modules[toGlobKey(spec)],
                `module introuvable pour ${spec}`,
            ).toBeDefined();
        });
    }
});

describe('routes.tsx — intégrité des paths', () => {
    it('aucun path dupliqué', () => {
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const p of declaredPaths) {
            if (seen.has(p)) dupes.push(p);
            seen.add(p);
        }
        expect(dupes, `paths dupliqués : ${dupes.join(', ')}`).toEqual([]);
    });
});
