"""Remplace les stubs MQ-<id> des interactions par des noms de substances lisibles.

Deux passes :
1. Résolution directe : l'id du stub est un id MQ_FORM → nom du produit
   correspondant dans le catalogue MQ (fiable, prioritaire).
2. Inférence (fallback) : un stub qui apparaît souvent du côté "produit"
   d'interactions avec des produits partageant le même principe actif est
   probablement ce principe actif.
"""
import csv
import os
import re
from collections import Counter

from django.conf import settings
from django.core.management.base import BaseCommand

from api.models import DrugInteraction, Produit, Substance


class Command(BaseCommand):
    help = 'Résout les noms des substances MQ stubs dans les interactions'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Simulation')
        parser.add_argument('--min-ratio', type=float, default=0.6,
                            help='Ratio minimum pour renommer un stub (0-1)')

    def _load_form_names(self):
        """MQ_FORM : id -> nom produit complet nettoyé (lookup direct)."""
        base = settings.BASE_DIR / 'dci' / 'export'
        names = {}
        try:
            with open(base / 'mq_form.csv', 'r', encoding='utf-8') as f:
                for r in csv.DictReader(f, delimiter=';'):
                    pid = (r.get('id') or '').strip()
                    raw = r.get('nom') or ''
                    if not pid or not raw:
                        continue
                    # Les métadonnées binaires suivent l'id répété dans le champ
                    if pid in raw:
                        raw = raw.split(pid, 1)[0]
                    # Le vrai nom est avant le premier bloc de 3+ espaces
                    # (le padding fixe sépare le nom des données binaires)
                    raw = re.split(r'\s{3,}', raw)[0]
                    raw = re.sub(r'\s+', ' ', raw).strip()
                    if raw and raw != pid and len(raw) >= 3:
                        names[pid] = raw
        except FileNotFoundError:
            pass
        return names

    def _load_form_principles(self):
        base = settings.BASE_DIR / 'dci' / 'export'
        mapping = {}
        try:
            with open(base / 'mq_form.csv', 'r', encoding='utf-8') as f:
                for r in csv.DictReader(f, delimiter=';'):
                    pid = (r.get('id') or '').strip()
                    nom = (r.get('nom') or '').strip()
                    if not pid:
                        continue
                    # extrait principe(s) actif(s) entre parenthèses
                    principles = []
                    for m in re.findall(r'\(([^()]+)\)', nom):
                        for part in m.split(','):
                            part = part.strip()
                            # ignore les références MQ et les tokens trop courts/bizarres
                            if (
                                part
                                and len(part) > 3
                                and not part.lower().startswith('mq-')
                                and not part.isdigit()
                            ):
                                principles.append(part.lower())
                    mapping[pid] = principles
        except FileNotFoundError:
            pass
        return mapping

    def _cip7_from_name(self, name):
        if not name or not name.startswith('MQ-'):
            return None
        code = name[3:].strip()
        # On ne considère que les vrais CIP7 (7 chiffres) comme identifiants produit
        if re.fullmatch(r'\d{7}', code):
            return code
        return None

    def _is_high_stub(self, name):
        if not name or not name.startswith('MQ-'):
            return False
        code = name[3:].strip()
        return len(code) > 7 or not code.isdigit()

    def _rename_stub(self, stub, new_name, dry_run):
        """Renomme un stub en évitant les collisions (nom unique) et en
        respectant max_length=255 (tronque la base, jamais le suffixe)."""
        if len(new_name) > 255:
            # Coupe au dernier espace avant la limite pour ne pas casser un mot
            suffix = f' ({stub.nom})'
            limit = 255 - len(suffix)
            base = new_name[:limit].rsplit(' ', 1)[0].rstrip(' ,;(')
            new_name = f'{base}{suffix}'
        if not dry_run:
            if Substance.objects.filter(nom__iexact=new_name).exists():
                new_name = f'{new_name} #{stub.id}'
            stub.nom = new_name[:255]
            stub.save(update_fields=['nom'])
        return new_name

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        min_ratio = options['min_ratio']
        form_principles = self._load_form_principles()
        form_names = self._load_form_names()

        stubs = Substance.objects.filter(nom__startswith='MQ-')
        total = stubs.count()
        self.stdout.write(self.style.HTTP_INFO(f'Stubs MQ trouvés : {total}'))

        renamed = 0
        renamed_direct = 0
        resolved_ids = set()

        # --- Passe 0 : nettoyage des noms déjà renommés avec des suffixes
        # (mq-…) multiples concaténés par les anciennes passes d'inférence ---
        cleaned_prev = 0
        for sub in Substance.objects.filter(nom__iregex=r'\(mq-\d+\).*\(mq-').iterator():
            groups = re.findall(r'(?i)\(mq-(\d+)\)', sub.nom)
            if len(groups) < 2:
                continue
            base = re.sub(r'(?i)\s*\(mq-[^)]*\)', '', sub.nom).strip()
            if not base:
                continue
            # Garde le dernier identifiant (celui du stub d'origine) comme provenance
            new_name = f'{base} (MQ-{groups[-1]})'
            if Substance.objects.filter(nom__iexact=new_name).exclude(pk=sub.pk).exists():
                new_name = f'{new_name} #{sub.id}'
            if not dry_run:
                sub.nom = new_name
                sub.save(update_fields=['nom'])
            cleaned_prev += 1
            if cleaned_prev <= 10:
                self.stdout.write(f'  nettoyé : {sub.nom} -> {new_name}')
        if cleaned_prev:
            self.stdout.write(self.style.HTTP_INFO(
                f'  → {cleaned_prev} noms nettoyés (suffixes multiples)'
            ))

        # --- Passe 1 : résolution directe via le libellé produit MQ_FORM ---
        self.stdout.write('Passe 1 : lookup direct dans MQ_FORM…')
        for stub in stubs.iterator():
            code = stub.nom[3:].strip()
            direct = form_names.get(code)
            if not direct:
                continue
            new_name = self._rename_stub(stub, f'{direct} ({stub.nom})', dry_run)
            resolved_ids.add(stub.id)
            renamed += 1
            renamed_direct += 1
            if renamed_direct <= 10:
                self.stdout.write(f'  {stub.nom} -> {new_name}')
        self.stdout.write(self.style.HTTP_INFO(
            f'  → {renamed_direct} stubs résolus directement via MQ_FORM'
        ))

        # --- Passe 2 : inférence par les partenaires d'interaction ---
        self.stdout.write('Passe 2 : inférence par partenaires…')
        skipped = 0
        for idx, stub in enumerate(stubs.iterator(), 1):
            if stub.id in resolved_ids:
                continue
            if idx % 2000 == 0:
                self.stdout.write(f'  Progression {idx}/{total} (renommés {renamed})')

            # On ne traite que les stubs "hauts" (pas des CIP7 produits)
            if not self._is_high_stub(stub.nom):
                skipped += 1
                continue

            # Partenaires de ce stub
            partners = set()
            for inter in DrugInteraction.objects.filter(
                substance_a=stub
            ).select_related('substance_b'):
                partners.add(inter.substance_b.nom)
            for inter in DrugInteraction.objects.filter(
                substance_b=stub
            ).select_related('substance_a'):
                partners.add(inter.substance_a.nom)

            if not partners:
                continue

            # Collecte les principes actifs des produits partenaires
            candidates = []
            for p_name in partners:
                cip7 = self._cip7_from_name(p_name)
                if cip7:
                    p = (
                        Produit.objects.filter(cip1=cip7).first()
                        or Produit.objects.filter(cip2__icontains=cip7).first()
                    )
                    if p:
                        # substances déjà liées au produit
                        for s in p.substances.all():
                            if not s.nom.startswith('MQ-'):
                                candidates.append(s.nom.lower())
                    # fallback sur le nom MQ_FORM, même si le produit n'est pas en base
                    for pr in form_principles.get(cip7, []):
                        candidates.append(pr)
                else:
                    # partenaire déjà une substance nommée -> indice supplémentaire.
                    # On retire les suffixes de provenance (mq-…)/(MQ-…) laissés
                    # par des renommages précédents pour ne pas les concaténer.
                    cleaned = re.sub(r'(?i)\s*\(mq-[^)]*\)', '', p_name).strip()
                    if cleaned and not cleaned.startswith('MQ-'):
                        candidates.append(cleaned.lower())

            if not candidates:
                continue

            counter = Counter(candidates)
            best_name, best_count = counter.most_common(1)[0]
            ratio = best_count / len(candidates)
            if ratio < min_ratio:
                continue

            # Normalise le nom (majuscule première lettre)
            display_name = best_name[0].upper() + best_name[1:]
            new_name = self._rename_stub(stub, f'{display_name} ({stub.nom})', dry_run)

            renamed += 1
            if renamed <= 10 or dry_run:
                self.stdout.write(f'  {stub.nom} -> {new_name} (ratio {ratio:.0%})')

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ {renamed} stubs renommés, {skipped} CIP7 ignorés'
        ))
        if dry_run:
            self.stdout.write(self.style.WARNING('Aucune écriture (dry-run)'))
