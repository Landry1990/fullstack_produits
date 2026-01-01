"""
Script pour tester la création d'un élément de label et voir l'erreur exacte
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import LabelTemplate, LabelElement
from api.serializers_labels import LabelElementSerializer

# Récupérer le template ID 1
try:
    template = LabelTemplate.objects.get(id=1)
    print(f"✅ Template trouvé : {template.name}")
except LabelTemplate.DoesNotExist:
    print("❌ Template ID 1 introuvable")
    exit(1)

# Données d'exemple similaires à ce que le frontend envoie
test_data = {
    'template': 1,
    'element_type': 'TEXT',
    'x_mm': 10.0,
    'y_mm': 10.0,
    'width_mm': 50.0,
    'height_mm': 10.0,
    'static_text': 'Test',
    'field_name': '',
    'barcode_type': '',
    'barcode_height': 50,
    'show_barcode_text': True,
    'font_family': '0',
    'font_size': 30,
    'font_bold': False,
    'text_align': 'left',
    'rotation': 0,
    'order': 0,
    'line_thickness': 2
}

print(f"\n📝 Données de test :")
for key, value in test_data.items():
    print(f"  {key}: {value} ({type(value).__name__})")

# Test du serializer
serializer = LabelElementSerializer(data=test_data)

if serializer.is_valid():
    print("\n✅ Serializer valide!")
    element = serializer.save()
    print(f"✅ Élément créé avec succès: ID {element.id}")
else:
    print("\n❌ Erreurs de validation:")
    for field, errors in serializer.errors.items():
        print(f"  - {field}: {errors}")
