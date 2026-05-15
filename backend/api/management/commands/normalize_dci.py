"""
Fusionne les substances dupliquées avec dosages différents sous une seule DCI canonique.

Ex: "PARACETAMOL 500 MG", "PARACETAMOL 300 MG" → "PARACETAMOL"

Usage:
    python manage.py normalize_dci
    python manage.py normalize_dci --dry-run
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Substance, Produit


def extract_base_name(nom: str) -> str:
    """
    Extrait le nom de la substance sans dosage.
    Ex: "PARACETAMOL 500 MG" -> "PARACETAMOL"
    """
    if not nom:
        return ""
    text = nom.upper().strip()
    # Supprimer les dosages: 500 MG, 3 000 G, 500 0 MG, 10.5 MG/ML, etc.
    text = re.sub(r'\b\d[\d\s,]*(?:\s+\d+)?\s*(?:MG|G|ML|UI|UG|MCG|µG|KG)(?:/\s*(?:ML|G|MG|H))?\b', '', text, flags=re.IGNORECASE)
    # Supprimer les nombres isolés en fin de chaîne (ex: "PARACETAMOL 0")
    text = re.sub(r'\s+\d+\s*$', '', text)
    # Supprimer "EFFERVESCENT", "COMPRIME", "SIROP" etc. (formes galéniques)
    formes = r'\b(?:COMPRIM[ÉE]?S?|G[ÉE]LULES?|SIROP|SUSPENSION|INJECTABLE|EFFERVESCENT|SUPPOSITOIRES?|CREME|POMMADE|SPANSULE|SACHETS?)\b'
    text = re.sub(formes, '', text, flags=re.IGNORECASE)
    # Supprimer les mentions "ACIDE", "BASE", "SEL"
    text = re.sub(r'\b(?:ACIDE|BASE|SEL)\b', '', text, flags=re.IGNORECASE)
    # Supprimer "SODIQUE", "POTASSIQUE", "CALCIQUE", "CHLORHYDRATE", etc.
    sels = r'\b(?:SODIQUE|POTASSIQUE|CALCIQUE|CHLORHYDRATE|SULFATE|PHOSPHATE|ACETATE|LACTATE|CITRATE|MALATE|TARTRATE)\b'
    text = re.sub(sels, '', text, flags=re.IGNORECASE)
    # Supprimer les articles isolés restants : "DE", "D'", "DU", "DES"
    text = re.sub(r"\b(DE|DU|DES|D')\b", ' ', text, flags=re.IGNORECASE)
    # Nettoyer les espaces et ponctuations résiduelles
    text = re.sub(r'[\(\)\[\],;:/\-_]', ' ', text)
    text = ' '.join(text.split())
    return text.strip()


class Command(BaseCommand):
    help = "Fusionne les substances avec dosages différents sous une DCI canonique"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Simulation sans modification')
        parser.add_argument('--min-group-size', type=int, default=2, help='Taille min d\'un groupe pour fusion')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        min_group_size = options['min_group_size']
        action = "🔍 SIMULATION" if dry_run else "🧹 Normalisation"
        self.stdout.write(self.style.HTTP_INFO(f"{action} des DCI..."))

        substances = list(Substance.objects.all().order_by('nom'))
        groups: dict[str, list[Substance]] = {}

        # Regrouper par nom de base
        for s in substances:
            base = extract_base_name(s.nom)
            if not base:
                continue
            if base not in groups:
                groups[base] = []
            groups[base].append(s)

        # Filtrer les groupes avec au moins min_group_size substances
        merge_groups = {k: v for k, v in groups.items() if len(v) >= min_group_size}
        if not merge_groups:
            self.stdout.write(self.style.WARNING("Aucun groupe de fusion trouvé"))
            return

        total_merged = 0
        total_products_updated = 0

        with transaction.atomic():
            for base_name, group in merge_groups.items():
                # Chercher ou créer la substance canonique
                canon, created = Substance.objects.get_or_create(
                    nom__iexact=base_name,
                    defaults={'nom': base_name}
                )
                if created:
                    self.stdout.write(f"   Créé DCI canonique : {base_name}")

                self.stdout.write(
                    f"   Fusion [{base_name}] : {[s.nom for s in group]} → {canon.nom}"
                )

                for old_sub in group:
                    if old_sub.id == canon.id:
                        continue  # ne pas se fusionner soi-même

                    # Produits liés à l'ancienne substance
                    produits_via_m2m = list(Produit.objects.filter(substances=old_sub))
                    produits_via_fk = list(Produit.objects.filter(dci_reference=old_sub))

                    if not dry_run:
                        for p in produits_via_m2m:
                            p.substances.remove(old_sub)
                            p.substances.add(canon)
                            # Mettre à jour dci_reference si c'était le cas
                            if p.dci_reference_id == old_sub.id:
                                p.dci_reference = canon
                                p.save(update_fields=['dci_reference'])
                            total_products_updated += 1

                        for p in produits_via_fk:
                            if p.dci_reference_id == old_sub.id:
                                p.dci_reference = canon
                                p.save(update_fields=['dci_reference'])
                                # S'assurer que la relation M2M existe aussi
                                if not p.substances.filter(id=canon.id).exists():
                                    p.substances.add(canon)
                                total_products_updated += 1

                        # Supprimer l'ancienne substance
                        old_sub.delete()

                    total_merged += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"   {len(merge_groups)} groupes auraient été fusionnés, "
                f"{total_merged} substances supprimées"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"   {len(merge_groups)} groupes fusionnés, "
                f"{total_merged} substances supprimées, "
                f"{total_products_updated} produits mis à jour"
            ))
