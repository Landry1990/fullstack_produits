"""
Interroge l'API OpenFDA pour récupérer les contre-indications / warnings
pour chaque substance et les stocke dans Substance.contre_indications.

Usage:
    python manage.py fetch_openfda_contre_indications
    python manage.py fetch_openfda_contre_indications --limit 100
    python manage.py fetch_openfda_contre_indications --substance PARACETAMOL
"""
import requests
import time
import json
from django.core.management.base import BaseCommand
from api.models import Substance


OPENFDA_URL = "https://api.fda.gov/drug/label.json"
HEADERS = {"User-Agent": "ZenithPharma/1.0"}


def fetch_fda_data(substance_name: str) -> dict | None:
    """
    Recherche un label FDA par substance active.
    Essaye d'abord substance_name, puis des variantes courantes.
    """
    queries = [
        f'openfda.substance_name:"{substance_name}"',
        f'openfda.generic_name:"{substance_name}"',
        f'openfda.active_ingredient:"{substance_name}"',
    ]

    # Mapping des noms français → anglais courants
    fr_to_en = {
        'PARACETAMOL': 'ACETAMINOPHEN',
        'IBUPROFENE': 'IBUPROFEN',
        'AMOXICILLINE': 'AMOXICILLIN',
        'CLAVULANIQUE': 'CLAVULANATE',
        'METFORMINE': 'METFORMIN',
        'SIMVASTATINE': 'SIMVASTATIN',
        'ATORVASTATINE': 'ATORVASTATIN',
        'ROSUVASTATINE': 'ROSUVASTATIN',
        'OMEPRAZOLE': 'OMEPRAZOLE',
        'ESOMEPRAZOLE': 'ESOMEPRAZOLE',
        'LANSOPRAZOLE': 'LANSOPRAZOLE',
        'PANTOPRAZOLE': 'PANTOPRAZOLE',
        'PAROXETINE': 'PAROXETINE',
        'SERTRALINE': 'SERTRALINE',
        'FLUOXETINE': 'FLUOXETINE',
        'CITALOPRAM': 'CITALOPRAM',
        'AMITRIPTYLINE': 'AMITRIPTYLINE',
        'CLARITHROMYCINE': 'CLARITHROMYCIN',
        'AZITHROMYCINE': 'AZITHROMYCIN',
        'CIPROFLOXACINE': 'CIPROFLOXACIN',
        'OFLOXACINE': 'OFLOXACIN',
        'METRONIDAZOLE': 'METRONIDAZOLE',
        'TRIMETHOPRIME': 'TRIMETHOPRIM',
        'SULFAMETHOXAZOLE': 'SULFAMETHOXAZOLE',
        'PREDNISONE': 'PREDNISONE',
        'PREDNISOLONE': 'PREDNISOLONE',
        'DEXAMETHASONE': 'DEXAMETHASONE',
        'BETAMETHASONE': 'BETAMETHASONE',
        'WARFARINE': 'WARFARIN',
        'ACENOCOUMAROL': 'ACENOCOUMAROL',
        'HEPARINE': 'HEPARIN',
        'ENOXAPARINE': 'ENOXAPARIN',
        'RAMIPRIL': 'RAMIPRIL',
        'ENALAPRIL': 'ENALAPRIL',
        'PERINDOPRIL': 'PERINDOPRIL',
        'LOSARTAN': 'LOSARTAN',
        'VALSARTAN': 'VALSARTAN',
        'IRBESARTAN': 'IRBESARTAN',
        'AMLODIPINE': 'AMLODIPINE',
        'NIFEDIPINE': 'NIFEDIPINE',
        'FELODIPINE': 'FELODIPINE',
        'BISOPROLOL': 'BISOPROLOL',
        'METOPROLOL': 'METOPROLOL',
        'CARVEDILOL': 'CARVEDILOL',
        'ATORVASTATINE': 'ATORVASTATIN',
        'FENOFIBRATE': 'FENOFIBRATE',
        'EZETIMIBE': 'EZETIMIBE',
        'ASPIRINE': 'ASPIRIN',
        'CLOPIDOGREL': 'CLOPIDOGREL',
        'PRASUGREL': 'PRASUGREL',
        'TICAGRELOR': 'TICAGRELOR',
        'SILDENAFIL': 'SILDENAFIL',
        'TADALAFIL': 'TADALAFIL',
        'VARDENAFIL': 'VARDENAFIL',
        'SUMATRIPTAN': 'SUMATRIPTAN',
        'ZOLMITRIPTAN': 'ZOLMITRIPTAN',
        'RIZATRIPTAN': 'RIZATRIPTAN',
        'ALMOTRIPTAN': 'ALMOTRIPTAN',
        'LORATADINE': 'LORATADINE',
        'CETIRIZINE': 'CETIRIZINE',
        'FEXOFENADINE': 'FEXOFENADINE',
        'LEVOCETIRIZINE': 'LEVOCETIRIZINE',
        'PSEUDOEPHEDRINE': 'PSEUDOEPHEDRINE',
        'PHENYLEPHRINE': 'PHENYLEPHRINE',
        'DEXTROMETHORPHAN': 'DEXTROMETHORPHAN',
        'ACETYLCYSTEINE': 'ACETYLCYSTEINE',
        'AMBROXOL': 'AMBROXOL',
        'BROMHEXINE': 'BROMHEXINE',
        'SALBUTAMOL': 'ALBUTEROL',
        'TERBUTALINE': 'TERBUTALINE',
        'FORMOTEROL': 'FORMOTEROL',
        'BUDESONIDE': 'BUDESONIDE',
        'FLUTICASONE': 'FLUTICASONE',
        'MOMETASONE': 'MOMETASONE',
        'BECLOMETASONE': 'BECLOMETASONE',
        'TIOTROPIUM': 'TIOTROPIUM',
        'IPRATROPIUM': 'IPRATROPIUM',
        'THEOPHYLLINE': 'THEOPHYLLINE',
        'DIAZEPAM': 'DIAZEPAM',
        'LORAZEPAM': 'LORAZEPAM',
        'ALPRAZOLAM': 'ALPRAZOLAM',
        'ZOLPIDEM': 'ZOLPIDEM',
        'ZOPICLONE': 'ZOPICLONE',
        'LEVOTHYROXINE': 'LEVOTHYROXINE',
        'LIOTHYRONINE': 'LIOTHYRONINE',
        'GLIBENCLAMIDE': 'GLIBENCLAMIDE',
        'GLICLAZIDE': 'GLICLAZIDE',
        'GLIMEPIRIDE': 'GLIMEPIRIDE',
        'PIOGLITAZONE': 'PIOGLITAZONE',
        'SITAGLIPTINE': 'SITAGLIPTIN',
        'SAXAGLIPTINE': 'SAXAGLIPTIN',
        'LINAGLIPTINE': 'LINAGLIPTIN',
        'DAPAGLIFLOZINE': 'DAPAGLIFLOZIN',
        'EMPAGLIFLOZINE': 'EMPAGLIFLOZIN',
        'CANAGLIFLOZINE': 'CANAGLIFLOZIN',
        'LIRAGLUTIDE': 'LIRAGLUTIDE',
        'SEMAGLUTIDE': 'SEMAGLUTIDE',
        'INSULINE': 'INSULIN',
        'FOSFOMYCINE': 'FOSFOMYCIN',
        'NITROFURANTOINE': 'NITROFURANTOIN',
        'PHENAZOPYRIDINE': 'PHENAZOPYRIDINE',
        'ALLOPURINOL': 'ALLOPURINOL',
        'FELOXICAM': 'FELOXICAM',
        'CELECOXIB': 'CELECOXIB',
        'DICLOFENAC': 'DICLOFENAC',
        'NAPROXENE': 'NAPROXEN',
        'KETOPROFENE': 'KETOPROFEN',
        'INDOMETHACINE': 'INDOMETHACIN',
        'COLCHICINE': 'COLCHICINE',
        'PROBENECIDE': 'PROBENECID',
        'METHOTREXATE': 'METHOTREXATE',
        'AZATHIOPRINE': 'AZATHIOPRINE',
        'MYCOPHENOLATE': 'MYCOPHENOLATE',
        'CICLOSPORINE': 'CICLOSPORIN',
        'TACROLIMUS': 'TACROLIMUS',
        'SIROLIMUS': 'SIROLIMUS',
        'EVEROLIMUS': 'EVEROLIMUS',
        'RITUXIMAB': 'RITUXIMAB',
        'INFLIXIMAB': 'INFLIXIMAB',
        'ADALIMUMAB': 'ADALIMUMAB',
        'ETANERCEPT': 'ETANERCEPT',
        'ABATACEPT': 'ABATACEPT',
        'TOCILIZUMAB': 'TOCILIZUMAB',
        'GOLIMUMAB': 'GOLIMUMAB',
        'USTEKINUMAB': 'USTEKINUMAB',
        'SECUKINUMAB': 'SECUKINUMAB',
        'IXEKIZUMAB': 'IXEKIZUMAB',
        'BRODALUMAB': 'BRODALUMAB',
        'GUSSELKUMAB': 'GUSSELKUMAB',
        'TILDRAKIZUMAB': 'TILDARAKIZUMAB',
        'RISANKIZUMAB': 'RISANKIZUMAB',
        'DUPILUMAB': 'DUPILUMAB',
        'OMALIZUMAB': 'OMALIZUMAB',
        'MEPOLIZUMAB': 'MEPOLIZUMAB',
        'RESILIZUMAB': 'RESILIZUMAB',
        'BENRALIZUMAB': 'BENRALIZUMAB',
        'TEZEPRUMAB': 'TEZELPELMAB',
        'ACIDE FOLIQUE': 'FOLIC ACID',
        'ACIDE ASCORBIQUE': 'ASCORBIC ACID',
        'VITAMINE D': 'CHOLECALCIFEROL',
        'VITAMINE B12': 'CYANOCOBALAMIN',
        'VITAMINE B1': 'THIAMINE',
        'VITAMINE B6': 'PYRIDOXINE',
        'MAGNESIUM': 'MAGNESIUM',
        'POTASSIUM': 'POTASSIUM',
        'CALCIUM': 'CALCIUM',
        'FER': 'IRON',
        'ZINC': 'ZINC',
        'SELENIUM': 'SELENIUM',
        'IODE': 'IODINE',
        'FLUOR': 'FLUORIDE',
    }

    en_name = fr_to_en.get(substance_name.upper(), substance_name.upper())

    for q in queries:
        q = q.replace(substance_name, en_name)
        try:
            resp = requests.get(OPENFDA_URL, params={"search": q, "limit": 1}, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("results"):
                    return data["results"][0]
            elif resp.status_code == 429:
                time.sleep(2)
                continue
        except Exception as e:
            print(f"   Erreur requête {q}: {e}")
            continue
        time.sleep(0.5)
    return None


def extract_safety(label: dict) -> str:
    """Extrait les sections de sécurité pertinentes du label FDA."""
    sections = []

    for key in ["contraindications", "warnings", "do_not_use", "precautions"]:
        if key in label and label[key]:
            val = label[key]
            if isinstance(val, list):
                val = " ".join(val)
            sections.append(f"=== {key.upper().replace('_', ' ')} ===\n{val.strip()}")

    if "pregnancy_or_breast_feeding" in label and label["pregnancy_or_breast_feeding"]:
        val = label["pregnancy_or_breast_feeding"]
        if isinstance(val, list):
            val = " ".join(val)
        sections.append(f"=== PREGNANCY / BREAST FEEDING ===\n{val.strip()}")

    return "\n\n".join(sections) if sections else ""


class Command(BaseCommand):
    help = "Récupère les contre-indications OpenFDA pour les substances"

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=0, help='Nombre max de substances à traiter (0 = toutes)')
        parser.add_argument('--substance', type=str, help='Traiter une substance spécifique')
        parser.add_argument('--dry-run', action='store_true', help='Simulation')

    def handle(self, *args, **options):
        limit = options['limit']
        substance_name = options.get('substance')
        dry_run = options['dry_run']

        qs = Substance.objects.all().order_by('nom')
        if substance_name:
            qs = qs.filter(nom__iexact=substance_name)
        if limit > 0:
            qs = qs[:limit]

        total = qs.count()
        self.stdout.write(self.style.HTTP_INFO(f"Traitement de {total} substance(s)..."))

        found = 0
        not_found = 0

        for i, sub in enumerate(qs):
            self.stdout.write(f"\n[{i+1}/{total}] {sub.nom} ...", ending=" ")

            # Si déjà rempli, on skip sauf si --substance explicit
            if sub.contre_indications and not substance_name:
                self.stdout.write(self.style.SUCCESS("(déjà présent)"))
                continue

            label = fetch_fda_data(sub.nom)
            if label:
                safety_text = extract_safety(label)
                if safety_text:
                    if not dry_run:
                        sub.contre_indications = safety_text
                        sub.save(update_fields=['contre_indications'])
                    self.stdout.write(self.style.SUCCESS(f"OK ({len(safety_text)} caractères)"))
                    found += 1
                else:
                    self.stdout.write(self.style.WARNING("Label trouvé mais pas de section sécurité"))
                    not_found += 1
            else:
                self.stdout.write(self.style.ERROR("Non trouvé"))
                not_found += 1

            # Rate limiting poli
            time.sleep(0.6)

        self.stdout.write(self.style.SUCCESS(f"\nTerminé : {found} trouvés, {not_found} non trouvés / vides"))
