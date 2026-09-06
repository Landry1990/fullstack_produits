
from typing import Any

from .models import DrugInteraction, Produit


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
        alerts = []
        if len(product_ids) < 2:
            return alerts

        # 1. Récupérer les produits et leurs substances
        # On précharge substances pour éviter N+1 requêtes
        products = Produit.objects.filter(id__in=product_ids).prefetch_related('substances')
        
        # Mapper Substance -> Liste de Produits (pour savoir quel produit cause quoi)
        substance_map = {}
        for product in products:
            for substance in product.substances.all():
                if substance.id not in substance_map:
                    substance_map[substance.id] = {'substance': substance, 'products': []}
                substance_map[substance.id]['products'].append(product)

        substance_ids = list(substance_map.keys())

        # 2. Chercher les interactions connues entre ces substances
        # On cherche A vs B OU B vs A
        interactions = DrugInteraction.objects.filter(
            substance_a__id__in=substance_ids,
            substance_b__id__in=substance_ids
        ).select_related('substance_a', 'substance_b')

        # 3. Construire les alertes d'interaction
        processed_pairs = set()

        for interaction in interactions:
            s_a = interaction.substance_a
            s_b = interaction.substance_b
            
            # Éviter les doublons si A-B et B-A existent (peu probable avec unique_together mais bon)
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

                    alerts.append({
                        'type': 'INTERACTION',
                        'gravity': interaction.gravity,
                        'title': f"Interaction : {s_a.nom} + {s_b.nom}",
                        'description': interaction.description,
                        'product_a': {
                            'id': p_a.id,
                            'name': p_a.name
                        },
                        'product_b': {
                            'id': p_b.id,
                            'name': p_b.name
                        }
                    })

        # 4. Détecter les redondances (même substance dans 2+ produits différents)
        for info in substance_map.values():
            if len(info['products']) >= 2:
                substance = info['substance']
                product_names = [p.name for p in info['products']]
                alerts.append({
                    'type': 'REDUNDANCY',
                    'gravity': 'A_PRENDRE_EN_COMPTE',
                    'title': f"Redondance : {substance.nom}",
                    'description': f"Plusieurs produits contiennent la même substance ({substance.nom}): {', '.join(product_names)}. Risque de surdosage.",
                    'product_a': {
                        'id': info['products'][0].id,
                        'name': info['products'][0].name
                    },
                    'product_b': {
                        'id': info['products'][1].id,
                        'name': info['products'][1].name
                    }
                })

        return alerts
