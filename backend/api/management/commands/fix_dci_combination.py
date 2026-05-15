"""
Corrige le dci_reference des produits combinaisons (ex: AUGMENTIN)
en choisissant la substance principale (plus forte dosage).

Usage:
    python manage.py fix_dci_combination
    python manage.py fix_dci_combination --dry-run
"""
import re
from django.core.management.base import BaseCommand
from api.models import Produit, MedicamentReference, Substance


def parse_dosage(text: str) -> float:
    """Extrait le dosage numérique en MG. Ex: '500 MG' -> 500, '1 G' -> 1000"""
    text = text.upper().replace(',', '.')
    # Cherche nombre + unité
    m = re.search(r'(\d+(?:\.\d+)?)\s*(MG|G|ML|UI|UG|MCG)', text)
    if not m:
        return 0.0
    val = float(m.group(1))
    unit = m.group(2)
    if unit == 'G':
        return val * 1000
    if unit == 'MCG' or unit == 'µG':
        return val * 0.001
    return val


class Command(BaseCommand):
    help = "Corrige dci_reference pour les produits combinaisons"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Simulation')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        action = "🔍 SIMULATION" if dry_run else "🔧 Correction"
        self.stdout.write(self.style.HTTP_INFO(f"{action} des DCI combinaisons..."))

        fixed = 0
        checked = 0

        # Produit liés à plusieurs substances
        for produit in Produit.objects.filter(substances__isnull=False).distinct():
            substances = list(produit.substances.all())
            if len(substances) < 2:
                continue

            checked += 1
            ref = MedicamentReference.objects.filter(nom__icontains=produit.name.split()[0]).first()
            if not ref or not ref.substances:
                continue

            # Parser les substances du médicament de référence avec dosage
            ref_entries = [s.strip() for s in ref.substances.split(';') if s.strip()]
            best_substance = None
            best_dosage = 0.0

            for entry in ref_entries:
                dosage = parse_dosage(entry)
                # Trouver la substance correspondante (nom sans dosage)
                entry_clean = re.sub(r'\b\d[\d\s.,]*\s*(?:MG|G|ML|UI|UG|MCG|µG)(?:/\s*(?:ML|G|MG|H))?\b', '', entry, flags=re.IGNORECASE).strip()
                entry_clean = re.sub(r'\s+\d+\s*$', '', entry_clean)
                # Normaliser
                entry_norm = entry_clean.upper()

                for sub in substances:
                    sub_norm = sub.nom.upper()
                    if sub_norm in entry_norm or entry_norm in sub_norm or self._fuzzy_match(sub_norm, entry_norm):
                        if dosage > best_dosage:
                            best_dosage = dosage
                            best_substance = sub

            if best_substance and produit.dci_reference_id != best_substance.id:
                self.stdout.write(
                    f"   {produit.name}: {produit.dci_reference.nom if produit.dci_reference else 'None'} "
                    f"-> {best_substance.nom} (dosage {best_dosage} MG)"
                )
                if not dry_run:
                    produit.dci_reference = best_substance
                    produit.save(update_fields=['dci_reference'])
                fixed += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(f"   {checked} produits vérifiés, {fixed} auraient été corrigés"))
        else:
            self.stdout.write(self.style.SUCCESS(f"   {checked} produits vérifiés, {fixed} corrigés"))

    def _fuzzy_match(self, a: str, b: str) -> bool:
        # Vérifie si les mots clés majeurs se chevauchent
        a_words = set(a.split())
        b_words = set(b.split())
        overlap = a_words & b_words
        return len(overlap) >= max(1, min(len(a_words), len(b_words)) - 1)
