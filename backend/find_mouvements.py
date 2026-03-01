import re

with open('api/views/produits.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'MouvementStock.objects.create' in line:
            print(f"Line {i}: {line.strip()}")
            # Print next 10 lines
            next_lines = []
            try:
                for _ in range(10):
                    next_lines.append(next(f).strip())
                print("\n".join(next_lines))
                print("-" * 20)
            except StopIteration:
                break
