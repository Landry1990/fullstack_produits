with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
line = lines[441]
with open(r'c:\Projet Fullstack\fullstack_produits\log_repr.txt', 'w', encoding='utf-8') as out:
    out.write('REPR=' + repr(line) + '\n')
    out.write('LEN=' + str(len(line)) + '\n')
    for i, ch in enumerate(line):
        out.write(f'{i}: {repr(ch)}\n')
