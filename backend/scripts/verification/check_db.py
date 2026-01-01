from api.models import AyantDroit, Client

print("=" * 50)
print("VÉRIFICATION BASE DE DONNÉES")
print("=" * 50)

# Tous les ayants droit
ayants_droit = AyantDroit.objects.all()
print(f"\n✅ Nombre total d'ayants droit: {ayants_droit.count()}")

for ad in ayants_droit:
    print(f"\n📋 Ayant Droit ID: {ad.id}")
    print(f"   Nom: {ad.nom}")
    print(f"   Matricule: {ad.matricule}")
    print(f"   Société: {ad.societe or 'N/A'}")
    print(f"   Client ID: {ad.client_id}")
    print(f"   Client Nom: {ad.client.name if ad.client else 'N/A'}")

# Clients professionnels
print("\n" + "=" * 50)
print("CLIENTS PROFESSIONNELS")
print("=" * 50)

clients_pro = Client.objects.filter(client_type='PROFESSIONNEL')
print(f"\n✅ Nombre de clients professionnels: {clients_pro.count()}")

for client in clients_pro:
    print(f"\n📋 Client: {client.name} (ID: {client.id})")
    print(f"   Type: {client.client_type}")
    
    # Ayants droit de ce client
    ayants = client.ayants_droit.all()
    print(f"   Ayants droit: {ayants.count()}")
    
    for ad in ayants:
        print(f"      - {ad.nom} (Mat: {ad.matricule}, Société: {ad.societe or 'N/A'})")
