"""
Commande de setup DCI/Substances pour la production.

À exécuter une seule fois après les migrations, sur la base prod.

Usage:
    python manage.py setup_dci_prod
    python manage.py setup_dci_prod --skip-med-ref
    python manage.py setup_dci_prod --skip-link
"""
import os
import sys
import csv
import unicodedata
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Substance, MedicamentReference, Produit


class Command(BaseCommand):
    help = 'Setup DCI/Substances en production (migrations déjà appliquées)'

    def add_arguments(self, parser):
        parser.add_argument('--skip-substances', action='store_true', help='Skip import des substances')
        parser.add_argument('--skip-med-ref', action='store_true', help='Skip import des médicaments de référence')
        parser.add_argument('--skip-link', action='store_true', help='Skip auto-link des produits existants')
        parser.add_argument('--compo-file', type=str, default='COMPO.txt', help='Chemin COMPO.txt')
        parser.add_argument('--meds-file', type=str, default='unified_meds.txt', help='Chemin unified_meds.txt')

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO("=== Setup DCI Production ==="))

        # 1. Import Substances
        if not options['skip_substances']:
            self._import_substances(options['compo_file'])

        # 2. Import MedicamentReference
        if not options['skip_med_ref']:
            self._import_med_ref(options['meds_file'])

        # 3. Auto-link produits existants
        if not options['skip_link']:
            self._auto_link_produits()

        self.stdout.write(self.style.SUCCESS("\n✅ Setup DCI terminé avec succès !"))

    def _import_substances(self, compo_path):
        if not os.path.exists(compo_path):
            self.stderr.write(self.style.WARNING(f"Fichier non trouvé : {compo_path} — étape ignorée"))
            return

        self.stdout.write("\n📥 Import des substances depuis COMPO.txt...")
        substances = set()
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                with open(compo_path, 'r', encoding=encoding) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split('\t')
                        if len(parts) >= 4:
                            nom = parts[3].strip()
                            if nom:
                                substances.add(nom)
                break
            except UnicodeDecodeError:
                continue

        created = 0
        existing = 0
        for nom in sorted(substances):
            obj, was_created = Substance.objects.get_or_create(
                nom__iexact=nom,
                defaults={'nom': nom}
            )
            if was_created:
                created += 1
            else:
                existing += 1

        self.stdout.write(self.style.SUCCESS(
            f"   {created} substances créées, {existing} déjà existantes (total: {Substance.objects.count()})"
        ))

    def _import_med_ref(self, meds_path):
        if not os.path.exists(meds_path):
            self.stderr.write(self.style.WARNING(f"Fichier non trouvé : {meds_path} — étape ignorée"))
            return

        self.stdout.write("\n📥 Import des médicaments de référence...")
        count = 0
        batch = []
        batch_size = 1000

        with open(meds_path, 'r', encoding='utf-8') as f:
            f.readline()  # skip header
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) >= 2:
                    batch.append(MedicamentReference(
                        cis=parts[0],
                        nom=parts[1],
                        forme=parts[2] if len(parts) > 2 else "",
                        substances=parts[3] if len(parts) > 3 else ""
                    ))
                    if len(batch) >= batch_size:
                        MedicamentReference.objects.bulk_create(
                            batch,
                            update_conflicts=True,
                            update_fields=['nom', 'forme', 'substances'],
                            unique_fields=['cis']
                        )
                        count += len(batch)
                        batch = []

            if batch:
                MedicamentReference.objects.bulk_create(
                    batch,
                    update_conflicts=True,
                    update_fields=['nom', 'forme', 'substances'],
                    unique_fields=['cis']
                )
                count += len(batch)

        self.stdout.write(self.style.SUCCESS(f"   {count} médicaments de référence importés"))

    def _normalize(self, text):
        if not text:
            return ""
        text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
        text = text.upper()
        text = re.sub(r'(\d+)\s*(MG|G|ML|UI|UG)', r'\1 \2', text)
        text = re.sub(r'[,\.;:/!|_]', ' ', text)
        text = " ".join(text.split())
        return text

    def _auto_link_produits(self):
        self.stdout.write("\n🔗 Auto-link des produits existants aux DCI...")
        produits = Produit.objects.filter(dci_reference__isnull=True)
        total = produits.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("   Aucun produit à lier — tout est déjà à jour"))
            return

        substances_map = {self._normalize(s.nom): s for s in Substance.objects.all()}
        linked = 0

        for i, p in enumerate(produits):
            if i % 100 == 0:
                self.stdout.write(f"   Progression {i}/{total} (liés: {linked})")

            p_keywords = [t for t in self._normalize(p.name).split() if len(t) > 2]
            if not p_keywords:
                continue

            # Stratégie 1: recherche dans MedicamentReference
            ref = MedicamentReference.objects.filter(nom__icontains=p.name).first()
            if not ref and len(p_keywords) >= 2:
                prefix = f"{p_keywords[0]} {p_keywords[1]}"
                ref = MedicamentReference.objects.filter(nom__istartswith=prefix).first()

            was_linked = False
            if ref and ref.substances:
                for s_name in [s.strip() for s in ref.substances.split(';') if s.strip()]:
                    s_norm = self._normalize(s_name)
                    substance = substances_map.get(s_norm)
                    if not substance:
                        substance, _ = Substance.objects.get_or_create(nom=s_norm)
                        substances_map[s_norm] = substance
                    p.substances.add(substance)
                    if not p.dci_reference:
                        p.dci_reference = substance
                    was_linked = True

            # Stratégie 2: mot-clé est une DCI connue
            if not was_linked:
                for kw in p_keywords:
                    if len(kw) > 4:
                        substance = substances_map.get(kw)
                        if substance:
                            p.substances.add(substance)
                            if not p.dci_reference:
                                p.dci_reference = substance
                            was_linked = True
                            break

            if was_linked:
                p.is_generic = True
                p.save()
                linked += 1

        self.stdout.write(self.style.SUCCESS(f"   {linked}/{total} produits liés à une DCI"))
