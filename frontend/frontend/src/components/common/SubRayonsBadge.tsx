import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';
import { Badge } from '../shadcn/badge';
import { childRayons, type RayonLike } from '../../utils/rayon';

interface SubRayonsBadgeProps {
    rayons: RayonLike[];
    /** Valeur du <select> rayon ('' ou null = aucun filtre). */
    rayonId: string | number | null | undefined;
    className?: string;
}

/**
 * Indicateur « +N sous-rayons » à afficher près d'un filtre rayon dont la
 * requête backend passe include_children=1 — sinon l'utilisateur ne comprend
 * pas pourquoi des produits d'autres rayons apparaissent.
 * Rend null si le rayon sélectionné n'a pas d'enfant.
 */
export const SubRayonsBadge = ({ rayons, rayonId, className }: SubRayonsBadgeProps) => {
    const { t } = useTranslation('common');
    const id = Number(rayonId);
    if (!rayonId || Number.isNaN(id)) return null;
    const count = childRayons(rayons, id).length;
    if (count === 0) return null;
    return (
        <Badge
            variant="secondary"
            className={className ?? 'px-2 py-0 text-[10px] gap-1'}
            title={t('sub_rayons_included_title')}
        >
            <Layers className="size-3" />
            {t('sub_rayons_included', { count })}
        </Badge>
    );
};
