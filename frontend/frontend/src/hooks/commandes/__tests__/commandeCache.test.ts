import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { removeCommandeFromCache, removeCommandesFromCache } from '../../useCommandeActions';

const setupCache = (results: { id: number }[], count: number) => {
    const qc = new QueryClient();
    qc.setQueryData(['commandes', { page: 1 }], { results, count });
    qc.setQueryData(['commandes', { page: 2 }], { results: [...results], count });
    return qc;
};

describe('commande cache helpers', () => {
    it('removeCommandeFromCache retire une commande et décrémente le compteur', () => {
        const qc = setupCache([{ id: 1 }, { id: 2 }, { id: 3 }], 3);
        removeCommandeFromCache(qc, 2);
        expect(qc.getQueryData(['commandes', { page: 1 }])?.results).toEqual([{ id: 1 }, { id: 3 }]);
        expect(qc.getQueryData(['commandes', { page: 1 }])?.count).toBe(2);
    });

    it('removeCommandeFromCache ne modifie pas les résultats si la commande est absente', () => {
        const qc = setupCache([{ id: 1 }, { id: 3 }], 2);
        removeCommandeFromCache(qc, 99);
        expect(qc.getQueryData(['commandes', { page: 1 }])?.results).toEqual([{ id: 1 }, { id: 3 }]);
    });

    it('removeCommandesFromCache retire plusieurs commandes et décrémente le compteur', () => {
        const qc = setupCache([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], 4);
        removeCommandesFromCache(qc, [1, 3]);
        expect(qc.getQueryData(['commandes', { page: 1 }])?.results).toEqual([{ id: 2 }, { id: 4 }]);
        expect(qc.getQueryData(['commandes', { page: 1 }])?.count).toBe(2);
    });

    it('removeCommandesFromCache affecte toutes les requêtes commandes', () => {
        const qc = setupCache([{ id: 1 }, { id: 2 }], 2);
        removeCommandeFromCache(qc, 2);
        expect(qc.getQueryData(['commandes', { page: 1 }])?.results).toEqual([{ id: 1 }]);
        expect(qc.getQueryData(['commandes', { page: 2 }])?.results).toEqual([{ id: 1 }]);
    });
});
