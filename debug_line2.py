with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
with open(r'c:\Projet Fullstack\fullstack_produits\output.txt', 'w', encoding='utf-8') as out:
    out.write('LINE 442: ' + repr(lines[441]))
