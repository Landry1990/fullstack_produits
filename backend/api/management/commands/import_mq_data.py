"""Import des données médicamenteuses MQ (MyISAM exportées en CSV).

Source attendue : dci/export/ généré par dci/export_dci.py.

Premier périmètre :
- Création des Substances depuis MQ_MONOG (noms explicites) + stubs pour les IDs
  référencés par MQ_INTER mais absents de MQ_MONOG.
- Import des interactions MQ_INTER → DrugInteraction (gravité depuis MQ_INTXT).
- Liaison Produit ↔ Substance via Produit.cip1 = MQ_FORM.id (CIP7) en parsant
  le principe actif entre parenthèses dans le nom MQ_FORM.
- Peuplement optionnel de Produit.code_atc via MQ_CLASS.
"""
import csv
import os
import re
import unicodedata
from collections import defaultdict

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import DrugInteraction, Produit, Substance


DEFAULT_EXPORT_DIR = str(settings.BASE_DIR / 'dci' / 'export')

INTXT_TO_GRAVITY = {
    'P1*': 'A_PRENDRE_EN_COMPTE',
    'P2*': 'PRECAUTION',
    'D3*': 'DECONSEILLE',
}

GRAVITY_BY_LABEL = {
    'CONTRE INDICATION': 'CONTRE_INDIQUE',
    'CONTRE-INDICATION': 'CONTRE_INDIQUE',
}

FALLBACK_GRAVITY = 'PRECAUTION'

BATCH_SIZE = 1000


class Command(BaseCommand):
    help = 'Import des données médicamenteuses MQ depuis dci/export'

    def add_arguments(self, parser):
        parser.add_argument('--export-dir', type=str, default=DEFAULT_EXPORT_DIR,
                            help='Dossier contenant les CSV exportés (défaut: dci/export)')
        parser.add_argument('--skip-substances', action='store_true',
                            help='Ne pas importer/compléter les substances')
        parser.add_argument('--skip-interactions', action='store_true',
                            help="Ne pas importer les interactions")
        parser.add_argument('--skip-products', action='store_true',
                            help='Ne pas lier les produits CIP7 aux substances')
        parser.add_argument('--dry-run', action='store_true',
                            help='Ne pas écrire en base')

    def handle(self, *args, **options):
        self.export_dir = self._resolve_path(options['export_dir'])
        self.dry_run = options['dry_run']

        if not os.path.isdir(self.export_dir):
            self.stderr.write(self.style.ERROR(f"Dossier introuvable : {self.export_dir}"))
            return

        self.stdout.write(self.style.HTTP_INFO(f"=== Import MQ depuis {self.export_dir} ==="))
        if self.dry_run:
            self.stdout.write(self.style.WARNING("Mode dry-run : transaction annulée à la fin"))

        with transaction.atomic():
            # Mapping temporaires
            self.substances_by_name = {}
            self.substances_by_code = {}
            self.cip7_inter_ids = set()
            self.intxt_gravity = {}

            # --- 1. Substances ---
            if not options['skip_substances']:
                self._load_substances()

            # --- 2. Interactions ---
            if not options['skip_interactions']:
                self._load_intxt()
                self._import_interactions()

            # --- 3. Liaison produits ---
            if not options['skip_products']:
                self._link_products()

            if self.dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("\n🔄 Dry-run : aucune écriture persistée"))
            else:
                self.stdout.write(self.style.SUCCESS("\n✅ Import MQ terminé"))

    def _resolve_path(self, path):
        if os.path.isabs(path):
            return path
        # Chemin relatif par rapport à la racine du projet Django
        resolved = os.path.abspath(os.path.join(settings.BASE_DIR, path))
        return resolved

    def _normalize(self, text):
        if not text:
            return ""
        text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
        return re.sub(r'\s+', ' ', text).strip().upper()

    def _load_csv(self, name):
        path = os.path.join(self.export_dir, name)
        if not os.path.exists(path):
            return []
        with open(path, 'r', encoding='utf-8') as f:
            return list(csv.DictReader(f, delimiter=';'))

    def _load_substances(self):
        self.stdout.write("\n📥 Chargement des substances depuis mq_monog.csv...")
        rows = self._load_csv('mq_monog.csv')
        # Indexer les noms/ID référencés
        code_to_name = {}
        for r in rows:
            code = r.get('code', '').strip()
            name = r.get('nom', '').strip()
            if code and name:
                # Format MQ : "NOM COURT    DCI"
                code_to_name[code] = name

        # Précharger les substances existantes
        existing = {self._normalize(s.nom): s for s in Substance.objects.all()}
        created_count = 0
        updated_count = 0

        # Créer/maj depuis MQ_MONOG nommés
        to_create = []
        for code, raw_name in code_to_name.items():
            # On garde la DCI (dernière partie après espaces multiples)
            name = re.sub(r'\s+', ' ', raw_name).strip()
            norm = self._normalize(name)
            if not norm:
                continue
            if norm in existing:
                s = existing[norm]
                self.substances_by_name[norm] = s
                self.substances_by_code[code] = s
                continue
            to_create.append(Substance(nom=name))
            existing[norm] = None  # placeholder pour eviter doublon dans le batch

        if to_create:
            created = Substance.objects.bulk_create(to_create, batch_size=BATCH_SIZE,
                                                    ignore_conflicts=True)
            created_count = len(created)
            # Recharger pour mapping
            for s in Substance.objects.filter(nom__in=[x.nom for x in to_create]):
                self.substances_by_name[self._normalize(s.nom)] = s

        self.stdout.write(self.style.SUCCESS(
            f"   {created_count} substances créées depuis MQ_MONOG"
        ))

        # Indexer par code aussi sur les existantes
        for code, raw_name in code_to_name.items():
            norm = self._normalize(re.sub(r'\s+', ' ', raw_name).strip())
            s = self.substances_by_name.get(norm)
            if s:
                self.substances_by_code[code] = s

    def _ensure_substance_for_code(self, code):
        """Récupère/crée une substance pour un code MQ (CIP7 ou ID numérique)."""
        if code in self.substances_by_code:
            return self.substances_by_code[code]
        code = str(code).strip()
        if code in self.substances_by_code:
            return self.substances_by_code[code]
        # Tentative par nom normalisé (si c'est un nom)
        norm = self._normalize(code)
        s = self.substances_by_name.get(norm)
        if not s:
            # Stub : le code devient le nom temporaire
            s, _ = Substance.objects.get_or_create(
                nom__iexact=f"MQ-{code}",
                defaults={'nom': f"MQ-{code}"}
            )
            self.substances_by_name[self._normalize(s.nom)] = s
        if s:
            self.substances_by_code[code] = s
        return s

    def _load_intxt(self):
        self.stdout.write("\n📥 Chargement des types d'alerte MQ_INTXT...")
        rows = self._load_csv('mq_intxt.csv')
        for r in rows:
            code = (r.get('code') or '').strip().upper()
            label = (r.get('libelle') or '').strip().upper()
            gravity = INTXT_TO_GRAVITY.get(code)
            if not gravity:
                gravity = GRAVITY_BY_LABEL.get(label, FALLBACK_GRAVITY)
            try:
                intxt_id = int(r['id'])
            except (KeyError, ValueError):
                continue
            self.intxt_gravity[intxt_id] = (gravity, label)
        self.stdout.write(f"   {len(self.intxt_gravity)} mappings gravité chargés")

    def _import_interactions(self):
        self.stdout.write("\n📥 Import des interactions MQ_INTER...")
        rows = self._load_csv('mq_inter.csv')
        # Collecter tous les codes a/b pour créer les stubs en amont
        codes = set()
        for r in rows:
            try:
                a, b, t = int(r['a_id']), int(r['b_id']), int(r['intxt_id'])
            except (KeyError, ValueError):
                continue
            if a == 0 or b == 0:
                continue
            codes.add(a)
            codes.add(b)

        self.stdout.write(f"   {len(rows):,} lignes, {len(codes):,} codes uniques")

        # Stubs en une passe
        existing_stubs = {
            self._normalize(s.nom): s
            for s in Substance.objects.filter(nom__startswith='MQ-')
        }
        to_create = []
        for c in codes:
            stub_name = f"MQ-{c}"
            norm = self._normalize(stub_name)
            if norm in existing_stubs:
                self.substances_by_code[str(c)] = existing_stubs[norm]
                continue
            if norm in self.substances_by_name:
                continue
            to_create.append(Substance(nom=stub_name))
            existing_stubs[norm] = None
        if to_create:
            Substance.objects.bulk_create(to_create, batch_size=BATCH_SIZE,
                                        ignore_conflicts=True)
            for s in Substance.objects.filter(nom__in=[x.nom for x in to_create]):
                self.substances_by_name[self._normalize(s.nom)] = s
        # Associer codes
        for c in codes:
            s = self.substances_by_name.get(self._normalize(f"MQ-{c}"))
            if s:
                self.substances_by_code[str(c)] = s

        seen = set()
        to_create_inter = []
        to_update_inter = []
        existing_pairs = {}
        for sub_a_id, sub_b_id in DrugInteraction.objects.values_list('substance_a_id', 'substance_b_id'):
            pair = (sub_a_id, sub_b_id) if sub_a_id <= sub_b_id else (sub_b_id, sub_a_id)
            existing_pairs[pair] = None

        skipped = 0
        for r in rows:
            try:
                a, b, t = int(r['a_id']), int(r['b_id']), int(r['intxt_id'])
            except (KeyError, ValueError):
                continue
            if a == 0 or b == 0:
                continue
            # Les IDs 7 chiffres sont probablement des CIP7 (produits)
            for v in (a, b):
                if 1_000_000 <= v <= 9_999_999:
                    self.cip7_inter_ids.add(str(v))
            gravity, label = self.intxt_gravity.get(t, (FALLBACK_GRAVITY, ''))
            sa = self._ensure_substance_for_code(a)
            sb = self._ensure_substance_for_code(b)
            if not sa or not sb:
                skipped += 1
                continue
            if sa.id == sb.id:
                skipped += 1
                continue
            pair = (sa.id, sb.id) if sa.id <= sb.id else (sb.id, sa.id)
            if pair in seen:
                continue
            seen.add(pair)
            desc = f"Interaction MQ : {sa.nom} ↔ {sb.nom}"
            if label:
                desc += f" ({label})"
            if pair in existing_pairs:
                to_update_inter.append((pair[0], pair[1], gravity, desc))
            else:
                to_create_inter.append(DrugInteraction(
                    substance_a_id=pair[0],
                    substance_b_id=pair[1],
                    gravity=gravity,
                    description=desc,
                ))

        self.stdout.write(f"   paires uniques : {len(seen):,} (doublons/skips : {len(rows)-len(seen):,})")
        created = DrugInteraction.objects.bulk_create(to_create_inter,
                                                       batch_size=BATCH_SIZE,
                                                       ignore_conflicts=True)
        updated = 0
        for sub_a_id, sub_b_id, gravity, desc in to_update_inter:
            DrugInteraction.objects.filter(
                substance_a_id=sub_a_id, substance_b_id=sub_b_id
            ).update(gravity=gravity, description=desc)
            updated += 1
        self.stdout.write(self.style.SUCCESS(
            f"   {len(created):,} créées, {updated:,} mises à jour"
        ))

    def _link_products(self):
        self.stdout.write("\n🔗 Liaison Produit CIP7 → substances...")
        monog_rows = {r['code']: r for r in self._load_csv('mq_monog.csv')}
        form_rows = {r['id']: r for r in self._load_csv('mq_form.csv')}
        class_rows = self._load_csv('mq_class.csv')
        class_by_cip = {}
        for r in class_rows:
            # MQ_CLASS : code_a=ATC classe, code_b=ATC complet, class_id=CIP7
            cip = (r.get('class_id') or '').strip()
            if cip:
                class_by_cip[cip] = (r.get('code_a'), r.get('code_b'))

        # Précharger les substances déjà en base
        substances_map = {self._normalize(s.nom): s for s in Substance.objects.all()}
        linked_count = 0
        atc_count = 0
        name_index = defaultdict(list)
        for fr in form_rows.values():
            name = self._normalize(re.sub(r'\s+', ' ', fr.get('nom', '')))
            if name and len(name) > 5:
                name_index[name[:40]].append(fr)

        produits = Produit.objects.exclude(cip1__isnull=True).exclude(cip1='')
        total = produits.count()
        for i, p in enumerate(produits.iterator()):
            if i % 500 == 0:
                self.stdout.write(f"   Progression {i}/{total} (liés: {linked_count}, ATC: {atc_count})")

            cip = (p.cip1 or '').strip()
            form_row = form_rows.get(cip)
            if not form_row:
                # Fallback par nom normalisé (premiers 40 car.)
                p_norm = self._normalize(p.name)
                if p_norm and len(p_norm) > 5:
                    candidates = name_index.get(p_norm[:40])
                    if candidates:
                        form_row = candidates[0]
            monog_row = monog_rows.get(cip)
            matched_substances = []

            # 1. DCI depuis le nom MQ_FORM (texte entre parenthèses)
            if form_row:
                full_name = form_row.get('nom', '')
                # Plusieurs principes actifs possibles, séparés par des virgules
                actives = re.findall(r'\(([^()]+)\)', full_name)
                for active in actives:
                    for part in active.split(','):
                        part = part.strip()
                        norm = self._normalize(part)
                        if not norm or len(part) < 4:
                            continue
                        s = substances_map.get(norm)
                        if not s:
                            # Créer la substance si pas trouvée
                            if not self.dry_run:
                                s, _ = Substance.objects.get_or_create(
                                    nom__iexact=part,
                                    defaults={'nom': part}
                                )
                                substances_map[self._normalize(s.nom)] = s
                        if s:
                            matched_substances.append(s)

            # 2. Nom MONOG s'il existe
            if monog_row and monog_row.get('nom'):
                name = re.sub(r'\s+', ' ', monog_row['nom']).strip()
                # Format SHORT  DCI : on garde la fin
                parts = [x.strip() for x in name.split('  ') if x.strip()]
                dci = parts[-1] if parts else name
                norm = self._normalize(dci)
                s = substances_map.get(norm)
                if not s and dci:
                    s, _ = Substance.objects.get_or_create(
                        nom__iexact=dci,
                        defaults={'nom': dci}
                    )
                    substances_map[self._normalize(s.nom)] = s
                if s and s not in matched_substances:
                    matched_substances.append(s)

            # 3. ATC
            atc_info = class_by_cip.get(cip)
            if atc_info and not p.code_atc:
                full_atc = atc_info[1] or atc_info[0]
                if full_atc:
                    p.code_atc = full_atc[:20]
                    p.save(update_fields=['code_atc'])
                    atc_count += 1

            # 4. Liaison CIP7 ↔ stub interaction (déclenche les alertes produit↔produit)
            if cip in self.cip7_inter_ids:
                stub = self._ensure_substance_for_code(cip)
                if stub and stub not in matched_substances:
                    matched_substances.append(stub)

            if matched_substances:
                p.substances.add(*matched_substances)
                if not p.dci_reference:
                    p.dci_reference = matched_substances[0]
                    p.save(update_fields=['dci_reference'])
                linked_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"   {linked_count}/{total} produits liés, {atc_count} codes ATC ajoutés"
        ))
