"""Matching des produits sans CIP7 (ou sans liaison) par nom normalisé sur MQ_FORM.

Permet d'élargir la couverture du panneau pharmaco au-delà des ~1 300 produits
qui ont un CIP7 reconnu.
"""
import csv
import os
import re
import unicodedata

from django.conf import settings
from django.core.management.base import BaseCommand

from api.models import Produit, Substance


class Command(BaseCommand):
    help = 'Match les produits par nom normalisé sur MQ_FORM et lie les substances'

    def add_arguments(self, parser):
        parser.add_argument('--export-dir', type=str, default='dci/export',
                            help='Dossier contenant les CSV exportés')
        parser.add_argument('--dry-run', action='store_true',
                            help='Simulation sans écriture')
        parser.add_argument('--all', action='store_true',
                            help='Matcher tous les produits, même ceux déjà liés')

    def _resolve_path(self, path):
        if os.path.isabs(path):
            return path
        return os.path.abspath(os.path.join(settings.BASE_DIR, path))

    def _normalize(self, text):
        if not text:
            return ""
        text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
        text = re.sub(r'[^A-Z0-9]', ' ', text.upper())
        return re.sub(r'\s+', ' ', text).strip()

    def _active_principles(self, form_name):
        if not form_name:
            return []
        found = []
        for match in re.findall(r'\(([^()]+)\)', form_name):
            for part in match.split(','):
                part = part.strip()
                if part and len(part) > 2:
                    found.append(part)
        return found

    def _load_csv(self, name):
        path = os.path.join(self.export_dir, name)
        with open(path, 'r', encoding='utf-8') as f:
            return list(csv.DictReader(f, delimiter=';'))

    def handle(self, *args, **options):
        self.export_dir = self._resolve_path(options['export_dir'])
        self.dry_run = options['dry_run']

        if not os.path.isdir(self.export_dir):
            self.stderr.write(self.style.ERROR(f"Dossier introuvable : {self.export_dir}"))
            return

        self.stdout.write(self.style.HTTP_INFO(f"=== Matching par nom MQ depuis {self.export_dir} ==="))
        if self.dry_run:
            self.stdout.write(self.style.WARNING("Mode dry-run"))

        # Index MQ_FORM par tokens (marque + dosage)
        rows = self._load_csv('mq_form.csv')
        token_index = {}
        all_forms = []
        for r in rows:
            name = r.get('nom', '').strip()
            cip = r.get('id', '').strip()
            norm = self._normalize(name)
            tokens = norm.split()
            if len(tokens) < 2:
                continue
            all_forms.append((cip, name, r, set(tokens)))
            # clé : 2 premiers tokens (ex. OROKEN 200)
            key = tuple(tokens[:2])
            token_index.setdefault(key, []).append((cip, name, r, set(tokens)))
            # aussi index sur token 1 seul si le 2ème est court
            if len(tokens) >= 3 and len(tokens[1]) <= 3:
                token_index.setdefault((tokens[0], tokens[2]), []).append((cip, name, r, set(tokens)))

        # Index MQ_MONOG par DCI
        monog_rows = self._load_csv('mq_monog.csv')
        monog_by_dci = {}
        for r in monog_rows:
            full = (r.get('nom') or '')
            parts = [p.strip() for p in full.split('  ') if p.strip()]
            if len(parts) >= 2:
                dci = self._normalize(parts[-1])
                monog_by_dci.setdefault(dci, []).append(r)

        # Précharger substances
        substances_map = {self._normalize(s.nom): s for s in Substance.objects.all()}

        qs = Produit.objects.all() if options['all'] else Produit.objects.filter(substances__isnull=True)
        total = qs.count()
        matched = 0
        atc_count = 0

        for i, p in enumerate(qs.iterator()):
            if i % 500 == 0:
                self.stdout.write(f"   Progression {i}/{total} (matchés: {matched}, ATC: {atc_count})")

            p_norm = self._normalize(p.name)
            if len(p_norm) < 6:
                continue

            p_tokens = p_norm.split()
            if len(p_tokens) < 2:
                continue

            form_match = None
            candidates = []

            # 1. clé principale (2 premiers tokens)
            key = tuple(p_tokens[:2])
            candidates.extend(token_index.get(key, []))
            # 2. clé alternative si 2ème token court
            if len(p_tokens) >= 3 and len(p_tokens[1]) <= 3:
                candidates.extend(token_index.get((p_tokens[0], p_tokens[2]), []))

            if candidates:
                # Score = nombre de tokens communs (minimum 2)
                best = None
                best_score = 1
                p_token_set = set(p_tokens)
                for cand in candidates:
                    score = len(p_token_set & cand[3])
                    if score > best_score:
                        best_score = score
                        best = cand
                if best:
                    form_match = best

            if not form_match:
                continue

            cip, form_name, _, _ = form_match
            matched += 1
            principles = self._active_principles(form_name)
            matched_substances = []

            # Créer/lier les substances depuis le nom MQ_FORM
            for raw in principles:
                norm = self._normalize(raw)
                if not norm or len(raw) < 4:
                    continue
                s = substances_map.get(norm)
                if not s:
                    if not self.dry_run:
                        s, _ = Substance.objects.get_or_create(
                            nom__iexact=raw,
                            defaults={'nom': raw}
                        )
                        substances_map[self._normalize(s.nom)] = s
                if s and s not in matched_substances:
                    matched_substances.append(s)

            # DCI depuis monographies molécule
            for raw in principles:
                dci = self._normalize(raw)
                for mol_row in monog_by_dci.get(dci, []):
                    name = re.sub(r'\s+', ' ', mol_row.get('nom', '')).strip()
                    parts = [x.strip() for x in name.split('  ') if x.strip()]
                    dci_name = parts[-1] if parts else name
                    norm = self._normalize(dci_name)
                    s = substances_map.get(norm)
                    if not s and dci_name and not self.dry_run:
                        s, _ = Substance.objects.get_or_create(
                            nom__iexact=dci_name,
                            defaults={'nom': dci_name}
                        )
                        substances_map[self._normalize(s.nom)] = s
                    if s and s not in matched_substances:
                        matched_substances.append(s)

            if matched_substances and not self.dry_run:
                p.substances.add(*matched_substances)
                if not p.dci_reference:
                    p.dci_reference = matched_substances[0]
                    p.save(update_fields=['dci_reference'])

            # ATC depuis MQ_CLASS si on a le CIP7 du MQ_FORM
            if cip and not p.code_atc:
                for cls in self._load_csv('mq_class.csv'):
                    if (cls.get('class_id') or '').strip() == cip:
                        atc = (cls.get('code_b') or cls.get('code_a') or '').strip()
                        if atc:
                            p.code_atc = atc[:20]
                            p.save(update_fields=['code_atc'])
                            atc_count += 1
                            break

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ {matched}/{total} produits matchés par nom, {atc_count} codes ATC ajoutés"
        ))
        if self.dry_run:
            self.stdout.write(self.style.WARNING("Aucune écriture (dry-run)"))
