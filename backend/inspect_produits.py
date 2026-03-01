import re

with open('api/views/produits.py', 'r', encoding='utf-8') as f:
    content = f.read()

viewsets = re.findall(r'class\s+(\w+ViewSet)\(', content)
print(f"ViewSets: {viewsets}")

actions = re.findall(r'def\s+(\w+)\(self, request, pk=None\):', content)
print(f"Potential Actions: {actions}")
