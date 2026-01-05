from api.models import Client

print("=" * 60)
print("DIAGNOSTIC: Clients Professionnels")
print("=" * 60)

clients_pro = Client.objects.filter(client_type='PROFESSIONNEL')

if not clients_pro.exists():
    print("\n⚠️  AUCUN CLIENT PROFESSIONNEL")
else:
    print(f"\n✅ {clients_pro.count()} client(s) pro:\n")
    for c in clients_pro:
        print(f"📋 {c.name} (ID: {c.id})")
        print(f"   Taux: {c.taux_couverture}%")
        if c.taux_couverture is None or c.taux_couverture == 0:
            print(f"   ❌ PROBLÈME: Taux invalide!")
        else:
            print(f"   ✅ OK - Patient: {100-float(c.taux_couverture)}%, Assurance: {c.taux_couverture}%")
        print()
