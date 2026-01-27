
from typing import List, Dict, Any
from .models import Produit, Substance, DrugInteraction

class ClinicalService:
    """
    Service pour la vérification des interactions médicamenteuses et contre-indications.
    """

    @staticmethod
    def check_interactions(product_ids: List[int]) -> List[Dict[str, Any]]:
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
                    substance_map[substance.id] = []
                substance_map[substance.id].append(product)

        substance_ids = list(substance_map.keys())

        # 2. Chercher les interactions connues entre ces substances
        # On cherche A vs B OU B vs A
        interactions = DrugInteraction.objects.filter(
            substance_a__id__in=substance_ids,
            substance_b__id__in=substance_ids
        )

        # 3. Construire les alertes
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
            products_a = substance_map.get(s_a.id, [])
            products_b = substance_map.get(s_b.id, [])

            # Si c'est la MEME substance (redondance thérapeutique ?)
            # Pour l'instant on ne traite que les interactions explicites A != B définies dans la table
            
            # Créer une alerte pour chaque combinaison de produits touchés
            for p_a in products_a:
                for p_b in products_b:
                    if p_a.id == p_b.id:
                        continue # Interaction avec soi-même via substances multiples ? Possible mais rare.

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

        return alerts
