"""
Importe les interactions médicamenteuses depuis un fichier CSV.
Si aucun fichier n'est fourni, importe un jeu d'interactions courantes prédéfini.

Usage:
    python manage.py import_interactions
    python manage.py import_interactions --file interactions.csv
    python manage.py import_interactions --dry-run
"""
import csv
import unicodedata
import re
from django.core.management.base import BaseCommand
from api.models import Substance, DrugInteraction


def _normalize(text):
    if not text:
        return ""
    text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
    text = text.upper().strip()
    text = re.sub(r'[,\.;:/!|_\(\)]', ' ', text)
    text = " ".join(text.split())
    return text


# Jeu d'interactions courantes (basé sur le Thésaurus ANSM simplifié)
# Format: (substance_a, substance_b, gravity, description)
DEFAULT_INTERACTIONS = [
    # Contre-indiquées
    ("Warfarine", "Aspirine", "CONTRE_INDIQUE", "Risque hémorragique accru. Association déconseillée sauf avis médical spécialisé."),
    ("Warfarine", "Miconazole", "CONTRE_INDIQUE", "Augmentation de l'effet anticoagulant avec risque hémorragique."),
    ("Warfarine", "Fluconazole", "CONTRE_INDIQUE", "Augmentation importante de l'INR avec risque hémorragique."),
    ("Warfarine", "Ciprofloxacine", "CONTRE_INDIQUE", "Augmentation de l'effet anticoagulant. Surveillance stricte de l'INR."),
    ("Simvastatine", "Itraconazole", "CONTRE_INDIQUE", "Risque majoré d'effets indésirables musculaires (rhabdomyolyse)."),
    ("Simvastatine", "Clarithromycine", "CONTRE_INDIQUE", "Risque majoré d'effets indésirables musculaires (rhabdomyolyse)."),
    ("Simvastatine", "Erythromycine", "CONTRE_INDIQUE", "Risque majoré d'effets indésirables musculaires (rhabdomyolyse)."),
    ("Atorvastatine", "Itraconazole", "CONTRE_INDIQUE", "Risque majoré d'effets indésirables musculaires (rhabdomyolyse)."),
    ("Ciclosporine", "Itraconazole", "CONTRE_INDIQUE", "Augmentation de la ciclosporinémie avec risque de néphrotoxicité."),
    ("Methotrexate", "Trimethoprim", "CONTRE_INDIQUE", "Risque de toxicité hématologique sévère par addition d'effets antifoliques."),

    # Déconseillées
    ("Ibuprofene", "Aspirine", "DECONSEILLE", "Diminution de l'effet antiagrégant plaquettaire de l'aspirine. Prise d'AINS au moins 2h après l'aspirine."),
    ("Ibuprofene", "Lisinopril", "DECONSEILLE", "Risque d'insuffisance rénale aiguë chez le patient déshydraté. Diminution de l'effet antihypertenseur."),
    ("Enalapril", "Ibuprofene", "DECONSEILLE", "Risque d'insuffisance rénale aiguë. Diminution de l'effet antihypertenseur."),
    ("Spironolactone", "Lisinopril", "DECONSEILLE", "Risque d'hyperkaliémie potentiellement létale, surtout en cas d'insuffisance rénale."),
    ("Spironolactone", "Enalapril", "DECONSEILLE", "Risque d'hyperkaliémie potentiellement létale, surtout en cas d'insuffisance rénale."),
    ("Lithium", "Ibuprofene", "DECONSEILLE", "Augmentation de la lithiémie pouvant atteindre des valeurs toxiques."),
    ("Lithium", "Lisinopril", "DECONSEILLE", "Augmentation de la lithiémie pouvant atteindre des valeurs toxiques."),
    ("Digoxine", "Verapamil", "DECONSEILLE", "Augmentation de la digoxinémie avec risque de surdosage. Surveillance clinique et ECG."),
    ("Theophylline", "Ciprofloxacine", "DECONSEILLE", "Augmentation de la théophyllinémie avec risque de surdosage."),

    # Précautions d'emploi
    ("Metformine", "Ciprofloxacine", "PRECAUTION", "Risque d'hypoglycémie. Surveillance de la glycémie."),
    ("Glibenclamide", "Ciprofloxacine", "PRECAUTION", "Risque d'hypoglycémie. Surveillance de la glycémie."),
    ("Levothyroxine", "Fer", "PRECAUTION", "Diminution de l'absorption de la lévothyroxine. Prendre à 2h d'intervalle."),
    ("Levothyroxine", "Calcium", "PRECAUTION", "Diminution de l'absorption de la lévothyroxine. Prendre à 2h d'intervalle."),
    ("Doxycycline", "Calcium", "PRECAUTION", "Diminution de l'absorption de la doxycycline. Prendre à 2h d'intervalle."),
    ("Doxycycline", "Fer", "PRECAUTION", "Diminution de l'absorption de la doxycycline. Prendre à 2h d'intervalle."),
    ("Ciprofloxacine", "Calcium", "PRECAUTION", "Diminution de l'absorption de la ciprofloxacine. Prendre à 2h d'intervalle."),
    ("Ciprofloxacine", "Fer", "PRECAUTION", "Diminution de l'absorption de la ciprofloxacine. Prendre à 2h d'intervalle."),
    ("Omeprazole", "Clopidogrel", "PRECAUTION", "Diminution de l'effet antiagrégant du clopidogrel. Préférer pantoprazole."),
    ("Paracetamol", "Warfarine", "PRECAUTION", "Risque d'augmentation de l'INR aux doses supérieures à 4g/jour de paracétamol."),

    # A prendre en compte
    ("Aspirine", "Methotrexate", "A_PRENDRE_EN_COMPTE", "Augmentation de la toxicité du methotrexate (diminution de sa clairance rénale)."),
    ("Aspirine", "Lisinopril", "A_PRENDRE_EN_COMPTE", "Diminution de l'effet antihypertenseur de l'IEC chez l'hypertendu."),
    ("Ibuprofene", "Aspirine", "A_PRENDRE_EN_COMPTE", "Prise d'AINS 2h après l'aspirine pour ne pas réduire son effet cardioprotecteur."),
    ("Amoxicilline", "Allopurinol", "A_PRENDRE_EN_COMPTE", "Risque majoré d'éruption cutanée."),
]


class Command(BaseCommand):
    help = "Importe les interactions médicamenteuses depuis un CSV ou un jeu par défaut"

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, help='Fichier CSV (substance_a,substance_b,gravity,description)')
        parser.add_argument('--dry-run', action='store_true', help='Simulation sans modification')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        file_path = options.get('file')

        if file_path:
            self.stdout.write(self.style.HTTP_INFO(f"Import depuis {file_path}..."))
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                data = [(r.get('substance_a', ''), r.get('substance_b', ''), r.get('gravity', 'PRECAUTION'), r.get('description', '')) for r in reader]
        else:
            self.stdout.write(self.style.HTTP_INFO("Import du jeu d'interactions courantes par défaut..."))
            data = DEFAULT_INTERACTIONS

        # Cache des substances
        substances_cache = {}
        for s in Substance.objects.all():
            substances_cache[_normalize(s.nom)] = s

        created = 0
        updated = 0
        skipped = 0
        not_found = 0

        for nom_a, nom_b, gravity, description in data:
            nom_a = nom_a.strip()
            nom_b = nom_b.strip()
            gravity = gravity.strip().upper()

            if not nom_a or not nom_b:
                skipped += 1
                continue

            valid_gravities = [c[0] for c in DrugInteraction.GRAVITY_CHOICES]
            if gravity not in valid_gravities:
                self.stdout.write(self.style.WARNING(f"  Gravité invalide: {gravity} — ignoré"))
                skipped += 1
                continue

            sub_a = substances_cache.get(_normalize(nom_a))
            sub_b = substances_cache.get(_normalize(nom_b))

            if not sub_a:
                if not dry_run:
                    sub_a, _ = Substance.objects.get_or_create(
                        nom__iexact=nom_a, defaults={'nom': nom_a.upper()}
                    )
                    substances_cache[_normalize(nom_a)] = sub_a
                else:
                    not_found += 1
                    continue

            if not sub_b:
                if not dry_run:
                    sub_b, _ = Substance.objects.get_or_create(
                        nom__iexact=nom_b, defaults={'nom': nom_b.upper()}
                    )
                    substances_cache[_normalize(nom_b)] = sub_b
                else:
                    not_found += 1
                    continue

            if sub_a.id == sub_b.id:
                skipped += 1
                continue

            pair_a, pair_b = (sub_a, sub_b) if sub_a.id < sub_b.id else (sub_b, sub_a)

            exists = DrugInteraction.objects.filter(substance_a=pair_a, substance_b=pair_b).first()
            if exists:
                if not dry_run:
                    exists.gravity = gravity
                    exists.description = description
                    exists.save()
                updated += 1
            else:
                if not dry_run:
                    DrugInteraction.objects.create(
                        substance_a=pair_a, substance_b=pair_b,
                        gravity=gravity, description=description
                    )
                created += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"SIMULATION: {created} créées, {updated} mises à jour, {skipped} ignorées, {not_found} substances non trouvées"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Import terminé: {created} créées, {updated} mises à jour, {skipped} ignorées"
            ))
            total = DrugInteraction.objects.count()
            self.stdout.write(f"Total interactions en base: {total}")
