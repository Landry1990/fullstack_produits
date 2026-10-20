import re
from typing import Any

from django.db.models import Q

from .models import DrugInteraction, Produit, Substance


# Ordre de gravité (plus bas = plus sévère), pour la déduplication
GRAVITY_ORDER = {
    'CONTRE_INDIQUE': 0,
    'DECONSEILLE': 1,
    'PRECAUTION': 2,
    'A_PRENDRE_EN_COMPTE': 3,
}

# Les ids de "groupe d'interaction" MQ sont préfixés 0xFF (> 4.278e9)
MQ_GROUP_ID_MIN = 4_000_000_000


class ClinicalService:
    """
    Service pour la vérification des interactions médicamenteuses et contre-indications.
    """

    @staticmethod
    def check_interactions(product_ids: list[int]) -> list[dict[str, Any]]:
        """
        Vérifie les interactions entre une liste de produits.
        Retourne une liste d'alertes.
        """
        if len(product_ids) < 2:
            return []

        # 1. Récupérer les produits et leurs substances
        products = list(
            Produit.objects.filter(id__in=product_ids).prefetch_related('substances')
        )

        # Mapper Substance -> Liste de Produits (pour savoir quel produit cause quoi)
        substance_map = {}
        for product in products:
            for substance in product.substances.all():
                entry = substance_map.setdefault(
                    substance.id, {'substance': substance, 'products': []}
                )
                entry['products'].append(product)

        # 2. Entités MQ : stubs MQ-<CIP7> du produit (cip1/cip2, CIP13 supporté)
        from .product_pharma_service import (
            _load_mq_data, _product_cip7s, _resolve_other_name,
        )
        mq_data = _load_mq_data() or {}
        form_by_id = mq_data.get('form_by_id', {})

        def attach(substance, plist):
            entry = substance_map.setdefault(
                substance.id, {'substance': substance, 'products': []}
            )
            existing = {p.id for p in entry['products']}
            for p in plist:
                if p.id not in existing:
                    entry['products'].append(p)
                    existing.add(p.id)

        cip_to_products = {}
        for product in products:
            for cip in _product_cip7s(product):
                cip_to_products.setdefault(cip, []).append(product)

        if cip_to_products:
            stub_names = {f'MQ-{c}': c for c in cip_to_products}
            cip_stubs = {
                s.nom: s
                for s in Substance.objects.filter(nom__in=stub_names)
            }
            for name, stub in cip_stubs.items():
                attach(stub, cip_to_products[stub_names[name]])

            # Groupes d'interaction MQ : partenaire d'un stub CIP dont l'id
            # est > 4e9 (ligne mq_inter avec intxt_id=0 = appartenance à une
            # famille de produits partageant le même profil d'effets)
            stub_id_products = {
                s.id: cip_to_products[stub_names[n]] for n, s in cip_stubs.items()
            }
            if stub_id_products:
                partner_qs = DrugInteraction.objects.filter(
                    Q(substance_a_id__in=stub_id_products)
                    | Q(substance_b_id__in=stub_id_products)
                ).select_related('substance_a', 'substance_b')
                for inter in partner_qs:
                    for mine, other in (
                        (inter.substance_a, inter.substance_b),
                        (inter.substance_b, inter.substance_a),
                    ):
                        if mine.id not in stub_id_products:
                            continue
                        code = (other.nom or '')[3:] if (other.nom or '').startswith('MQ-') else ''
                        if code.isdigit() and int(code) >= MQ_GROUP_ID_MIN:
                            attach(other, stub_id_products[mine.id])

        substance_ids = list(substance_map.keys())

        # 3. Chercher les interactions connues entre ces entités
        # On cherche A vs B OU B vs A
        interactions = DrugInteraction.objects.filter(
            substance_a__id__in=substance_ids,
            substance_b__id__in=substance_ids
        ).select_related('substance_a', 'substance_b')

        def display_name(substance):
            resolved = _resolve_other_name(substance.nom, form_by_id) or substance.nom
            # Nettoie le suffixe technique "(MQ-123456)"
            cleaned = re.sub(r'\s*\(MQ-[^)]+\)\s*$', '', resolved).strip()
            if cleaned and not cleaned.startswith('MQ-'):
                return cleaned
            code = resolved[3:] if resolved.startswith('MQ-') else ''
            if code.isdigit() and int(code) >= MQ_GROUP_ID_MIN:
                # Famille d'interaction (groupe de produits à effets similaires)
                return 'Famille d\'interaction (produits à effets similaires)'
            return resolved

        def clean_description(desc, sa, sb):
            if not desc:
                return desc
            for stub in (sa, sb):
                if stub.nom and stub.nom in desc:
                    desc = desc.replace(stub.nom, display_name(stub))
            return desc

        # 4. Construire les alertes d'interaction — dédupliquées par paire de produits
        processed_pairs = set()
        best_by_product_pair = {}

        for interaction in interactions:
            s_a = interaction.substance_a
            s_b = interaction.substance_b

            # Éviter les doublons si A-B et B-A existent
            pair_key = tuple(sorted([s_a.id, s_b.id]))
            if pair_key in processed_pairs:
                continue
            processed_pairs.add(pair_key)

            # Identifier les produits concernés
            info_a = substance_map.get(s_a.id)
            info_b = substance_map.get(s_b.id)

            if not info_a or not info_b:
                continue

            products_a = info_a['products']
            products_b = info_b['products']

            # Créer une alerte pour chaque combinaison de produits touchés
            for p_a in products_a:
                for p_b in products_b:
                    if p_a.id == p_b.id:
                        continue

                    ppair = tuple(sorted([p_a.id, p_b.id]))
                    alert = {
                        'type': 'INTERACTION',
                        'gravity': interaction.gravity,
                        'title': f"Interaction : {display_name(s_a)} + {display_name(s_b)}",
                        'description': clean_description(interaction.description, s_a, s_b),
                        'product_a': {'id': p_a.id, 'name': p_a.name},
                        'product_b': {'id': p_b.id, 'name': p_b.name},
                    }
                    existing = best_by_product_pair.get(ppair)
                    if existing is None:
                        best_by_product_pair[ppair] = alert
                    else:
                        cur = GRAVITY_ORDER.get(alert['gravity'], 99)
                        prev = GRAVITY_ORDER.get(existing['gravity'], 99)
                        if cur < prev or (cur == prev and existing['type'] != 'INTERACTION'):
                            best_by_product_pair[ppair] = alert

        # 5. Détecter les redondances (même substance/groupe MQ dans 2+ produits)
        for info in substance_map.values():
            if len(info['products']) < 2:
                continue
            substance = info['substance']
            product_names = [p.name for p in info['products']]
            alerts_pair_products = info['products']
            for i, p_a in enumerate(alerts_pair_products):
                for p_b in alerts_pair_products[i + 1:]:
                    ppair = tuple(sorted([p_a.id, p_b.id]))
                    alert = {
                        'type': 'REDUNDANCY',
                        'gravity': 'A_PRENDRE_EN_COMPTE',
                        'title': f"Redondance : {display_name(substance)}",
                        'description': (
                            f"Plusieurs produits partagent {display_name(substance)} "
                            f"({', '.join(product_names)}). Risque de surdosage ou de cumul d'effets."
                        ),
                        'product_a': {'id': p_a.id, 'name': p_a.name},
                        'product_b': {'id': p_b.id, 'name': p_b.name},
                    }
                    existing = best_by_product_pair.get(ppair)
                    if existing is None:
                        best_by_product_pair[ppair] = alert
                    else:
                        cur = GRAVITY_ORDER.get(alert['gravity'], 99)
                        prev = GRAVITY_ORDER.get(existing['gravity'], 99)
                        # À gravité égale, préférer la redondance (plus explicite)
                        if cur <= prev:
                            best_by_product_pair[ppair] = alert

        alerts = sorted(
            best_by_product_pair.values(),
            key=lambda a: GRAVITY_ORDER.get(a['gravity'], 99),
        )
        return alerts[:50]
