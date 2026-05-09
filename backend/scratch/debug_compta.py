import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import EcritureComptable, LigneEcriture, CompteComptable

print("--- ANALYSE COMPTABILITE ---")
print(f"Total Ecritures: {EcritureComptable.objects.count()}")

journals = {}
for e in EcritureComptable.objects.all().select_related('journal'):
    code = e.journal.code
    journals[code] = journals.get(code, 0) + 1

print("\nRépartition par journal:")
for code, count in journals.items():
    print(f"- {code}: {count}")

print("\nZoom sur Journal AC (Achats):")
ac_entries = EcritureComptable.objects.filter(journal__code='AC')
for e in ac_entries:
    print(f"  ID: {e.id} | Date: {e.date} | Ref: {e.reference} | Libelle: {e.libelle}")
    for l in e.lignes.all().select_related('compte'):
        print(f"    - {l.compte.numero} ({l.compte.libelle}): D={l.debit}, C={l.credit}")

print("\nZoom sur Compte 601100 (Achats):")
lignes_601 = LigneEcriture.objects.filter(compte__numero='601100')
print(f"Total lignes 601100: {lignes_601.count()}")
for l in lignes_601:
    print(f"  Date: {l.ecriture.date} | Debit: {l.debit} | Credit: {l.credit}")
