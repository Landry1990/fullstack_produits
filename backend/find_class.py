filename = 'api/views/ventes.py'
with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Scanning {filename} for 'class CaisseViewSet'...")
count = 0
for i, line in enumerate(lines):
    if 'class CaisseViewSet' in line:
        count += 1
        print(f"Line {i+1}: {line.strip()}", flush=True)

print(f"Total occurrences: {count}", flush=True)
