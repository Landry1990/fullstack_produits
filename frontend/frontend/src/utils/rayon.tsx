import type { ReactNode } from 'react';
import type { Rayon } from '../types';

type RayonLike = Pick<Rayon, 'id' | 'name'> & Partial<Rayon>;

/**
 * Libellé complet d'un rayon : "PARENT › SOUS-RAYON" ou "RAYON".
 * À utiliser partout où le nom nu serait ambigu (listes plates, badges).
 */
export const rayonLabel = (r: RayonLike): string =>
    r.parent_name ? `${r.parent_name} › ${r.name}` : r.name;

/** Rayons racines (= sans parent, ou parent absent de la liste — filet de sécurité). */
export const rootRayons = (rayons: RayonLike[]): RayonLike[] => {
    const ids = new Set(rayons.map(r => r.id));
    return rayons.filter(r => !r.parent || !ids.has(r.parent));
};

export const childRayons = (rayons: RayonLike[], parentId: number): RayonLike[] =>
    rayons.filter(r => r.parent === parentId);

/**
 * Liste plate ordonnée hiérarchiquement : chaque parent suivi de ses
 * sous-rayons. Pour les listes custom (menus) — utiliser `r.parent`
 * pour indenter les enfants.
 */
export function orderedRayons(rayons: RayonLike[]): RayonLike[] {
    return rootRayons(rayons).flatMap(p => [p, ...childRayons(rayons, p.id)]);
}

/**
 * Options <select> hiérarchiques : un <optgroup> par rayon parent ayant des
 * sous-rayons (le parent reste sélectionnable comme première option),
 * les rayons sans enfant sont des options simples.
 */
export function renderRayonOptions(rayons: RayonLike[]): ReactNode {
    return rootRayons(rayons).map(parent => {
        const children = childRayons(rayons, parent.id);
        if (children.length === 0) {
            return <option key={parent.id} value={parent.id}>{parent.name}</option>;
        }
        return (
            <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>{parent.name}</option>
                {children.map(child => (
                    <option key={child.id} value={child.id}>↳ {child.name}</option>
                ))}
            </optgroup>
        );
    });
}
